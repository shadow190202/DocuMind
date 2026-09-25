import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentChunks, documentSummaries, documentComparisons } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getFile, saveExtractedData } from "@/lib/storage";
import { extractTextFromDocument } from "@/lib/parsers";
import { chunkDocument } from "@/lib/ai/chunker";
import {
  generateBatchEmbeddings,
  EMBEDDING_MODEL,
  EXPECTED_DIMENSIONS,
} from "@/lib/ai/gemini";
import {
  verifyDocumentAccess,
  toClientSafeDocument,
} from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/process
 * End-to-end processing pipeline:
 * 1. Extract text from file (PDF, DOCX, TXT, CSV)
 * 2. Save extracted text payload to private storage
 * 3. Chunk text recursively with grounding metadata
 * 4. Generate & validate 768-dim embeddings via Gemini API (gemini-embedding-001)
 * 5. Atomically replace chunks in PostgreSQL via db.transaction()
 *
 * Reprocessing policy:
 * - Owner: Allowed
 * - Editor ('write'): Allowed (replaces authoritative chunk/embedding data, invalidates summaries/comparisons)
 * - Viewer ('read'): 403 Forbidden
 * - Unauthorized: 404 Not Found
 */
export async function POST(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // 1. Verify document access (requires 'write' permission: owner or editor)
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "write",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const doc = access.document;

    // 2. Mark document status as 'processing'
    await db
      .update(documents)
      .set({
        processingStatus: "processing",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    // 3. Load file binary from secure storage
    let fileBuffer;
    try {
      fileBuffer = await getFile(doc.storageUrl);
    } catch (storageErr) {
      const errMsg = `Storage retrieval failed: ${storageErr.message}`;
      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    // 4. Extract text using dedicated parser
    let extractedResult;
    try {
      extractedResult = await extractTextFromDocument(fileBuffer, doc.fileType);
    } catch (extractErr) {
      console.error(`Text extraction failed for doc ${id}:`, extractErr);
      const errMsg = `Text extraction error: ${extractErr.message}`;

      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // Validate that extracted text is not empty
    if (!extractedResult.text || extractedResult.text.trim().length === 0) {
      const errMsg = "Extracted document text is empty. Cannot generate chunks or embeddings.";
      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // 5. Save structured extracted data to isolated storage using the document owner's user ID
    const extractedPayload = {
      documentId: doc.id,
      userId: doc.userId,
      filename: doc.filename,
      fileType: doc.fileType,
      text: extractedResult.text,
      pageCount: extractedResult.pageCount,
      pages: extractedResult.pages,
      metadata: extractedResult.metadata,
    };

    await saveExtractedData(extractedPayload, doc.id, doc.userId);

    // 6. Divide text into semantic chunks
    const chunks = chunkDocument(extractedResult);
    if (!chunks || chunks.length === 0) {
      const errMsg = "Chunking failed: no valid text segments could be created.";
      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // 7. Generate vector embeddings via official Gemini API
    // Must generate ALL embeddings and validate 768 dimensions BEFORE starting DB transaction
    let embeddings = [];
    try {
      const chunkTexts = chunks.map((c) => c.content);
      embeddings = await generateBatchEmbeddings(chunkTexts);

      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: generated ${embeddings.length} embeddings for ${chunks.length} chunks.`
        );
      }

      // Assert every embedding has length === 768
      for (let i = 0; i < embeddings.length; i++) {
        const emb = embeddings[i];
        if (!Array.isArray(emb) || emb.length !== EXPECTED_DIMENSIONS) {
          throw new Error(
            `Chunk ${i} embedding failed dimension validation: expected ${EXPECTED_DIMENSIONS}, received ${emb?.length}.`
          );
        }
      }
    } catch (embeddingErr) {
      console.error(`Embedding generation failed for doc ${id}:`, embeddingErr);
      const errMsg = `Embedding generation error: ${embeddingErr.message}`;

      // Mark document as failed, but PRESERVE existing database chunks
      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    // 8. Atomic Database Transaction: Delete old chunks & insert new chunks + embeddings
    await db.transaction(async (tx) => {
      // Delete existing chunks for this document
      await tx
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, id));

      // Transactional Cache Invalidation: invalidate comparisons where this document was source or target
      await tx
        .delete(documentComparisons)
        .where(
          or(
            eq(documentComparisons.sourceDocumentId, id),
            eq(documentComparisons.targetDocumentId, id)
          )
        );

      // Invalidate existing cached summaries for this document
      await tx
        .delete(documentSummaries)
        .where(eq(documentSummaries.documentId, id));

      // Prepare records for batch insertion
      const chunkRecords = chunks.map((chunk, index) => ({
        documentId: doc.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        pageNumber: chunk.pageNumber, // genuine number for PDF, null for DOCX/TXT/CSV
        embedding: embeddings[index], // validated 768 float array
        createdAt: new Date(),
      }));

      // Insert new chunks
      await tx.insert(documentChunks).values(chunkRecords);

      // Update document status to completed
      await tx
        .update(documents)
        .set({
          processingStatus: "completed",
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));
    });

    // 9. Fetch and return updated document record
    const [updatedDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    return NextResponse.json({
      success: true,
      message: "Document processed, chunked, and embedded successfully.",
      document: toClientSafeDocument(updatedDoc, access),
      chunksCount: chunks.length,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EXPECTED_DIMENSIONS,
      metadata: extractedResult.metadata,
    });
  } catch (error) {
    console.error("POST /api/documents/:id/process unexpected error:", error);
    return NextResponse.json(
      { error: `Internal server error during document processing: ${error.message}` },
      { status: 500 }
    );
  }
}
