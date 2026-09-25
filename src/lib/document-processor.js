import { db, getDb } from "../db/index.js";
import {
  documents,
  documentChunks,
  documentSummaries,
  documentComparisons,
} from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { getFile, saveExtractedData } from "./storage.js";
import { extractTextFromDocument } from "./parsers/index.js";
import { chunkDocument } from "./ai/chunker.js";
import {
  generateBatchEmbeddings,
  EXPECTED_DIMENSIONS,
} from "./ai/gemini.js";

/**
 * Authoritative end-to-end document processing pipeline.
 * Reused identically by both user document processing and admin document reprocessing.
 *
 * Guarantees & Invariants:
 * 1. Always uses doc.userId (owner identity) for storage and extracted text paths.
 * 2. Never uses the caller/admin ID as the storage identity.
 * 3. Synchronous execution: extracts text, chunks, embeds, and updates DB.
 * 4. Atomically replaces chunks and invalidates derived summary and comparison caches.
 * 5. On failure, captures error in documents.errorMessage and sets status = 'failed'.
 *
 * @param {Object} params
 * @param {Object} params.document - Database document record
 * @returns {Promise<{
 *   success: boolean,
 *   chunksCount: number,
 *   error?: string,
 *   status?: number
 * }>}
 */
export async function executeDocumentProcessing({ document: doc }) {
  const activeDb = db || getDb();
  if (!activeDb) {
    throw new Error("Database not configured.");
  }

  const id = doc.id;

  // 1. Mark document status as 'processing'
  await activeDb
    .update(documents)
    .set({
      processingStatus: "processing",
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));

  // 2. Load file binary from secure storage
  let fileBuffer;
  try {
    fileBuffer = await getFile(doc.storageUrl);
  } catch (storageErr) {
    const errMsg = `Storage retrieval failed: ${storageErr.message}`;
    await activeDb
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    return { success: false, error: errMsg, status: 500, chunksCount: 0 };
  }

  // 3. Extract text using dedicated parser
  let extractedResult;
  try {
    extractedResult = await extractTextFromDocument(fileBuffer, doc.fileType);
  } catch (extractErr) {
    console.error(`Text extraction failed for doc ${id}:`, extractErr);
    const errMsg = `Text extraction error: ${extractErr.message}`;

    await activeDb
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    return { success: false, error: errMsg, status: 422, chunksCount: 0 };
  }

  // Validate extracted text is not empty
  if (!extractedResult.text || extractedResult.text.trim().length === 0) {
    const errMsg = "Extracted document text is empty. Cannot generate chunks or embeddings.";
    await activeDb
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    return { success: false, error: errMsg, status: 422, chunksCount: 0 };
  }

  // 4. Save structured extracted data using the DOCUMENT OWNER'S user ID
  const extractedPayload = {
    documentId: doc.id,
    userId: doc.userId, // Strictly owner identity
    filename: doc.filename,
    fileType: doc.fileType,
    text: extractedResult.text,
    pageCount: extractedResult.pageCount,
    pages: extractedResult.pages,
    metadata: extractedResult.metadata,
  };

  await saveExtractedData(extractedPayload, doc.id, doc.userId);

  // 5. Divide text into semantic chunks
  const chunks = chunkDocument(extractedResult);
  if (!chunks || chunks.length === 0) {
    const errMsg = "Chunking failed: no valid text segments could be created.";
    await activeDb
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    return { success: false, error: errMsg, status: 422, chunksCount: 0 };
  }

  // 6. Generate vector embeddings via official Gemini API (gemini-embedding-001)
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
    await activeDb
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    return { success: false, error: errMsg, status: 502, chunksCount: 0 };
  }

  // 7. Atomic Database Transaction: Delete old chunks & insert new chunks + embeddings
  await activeDb.transaction(async (tx) => {
    // Delete existing chunks for this document
    await tx
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, id));

    // Cache Invalidation: Invalidate comparisons where this document was source or target
    await tx
      .delete(documentComparisons)
      .where(
        or(
          eq(documentComparisons.sourceDocumentId, id),
          eq(documentComparisons.targetDocumentId, id)
        )
      );

    // Cache Invalidation: Invalidate existing cached summaries for this document
    await tx
      .delete(documentSummaries)
      .where(eq(documentSummaries.documentId, id));

    // Prepare records for batch insertion
    const chunkRecords = chunks.map((chunk, index) => ({
      documentId: doc.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[index],
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

  return {
    success: true,
    chunksCount: chunks.length,
    error: null,
  };
}
