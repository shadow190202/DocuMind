import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getFile, saveExtractedData } from "@/lib/storage";
import { extractTextFromDocument } from "@/lib/parsers";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/process
 * Triggers the text extraction pipeline for a specific document.
 */
export async function POST(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // 1. Verify document ownership
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

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
      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: `Storage retrieval failed: ${storageErr.message}`,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json(
        { error: `Could not retrieve file from storage: ${storageErr.message}` },
        { status: 500 }
      );
    }

    // 4. Extract text using dedicated parser
    let extractedResult;
    try {
      extractedResult = await extractTextFromDocument(fileBuffer, doc.fileType);
    } catch (extractErr) {
      console.error(`Text extraction failed for doc ${id}:`, extractErr);

      await db
        .update(documents)
        .set({
          processingStatus: "failed",
          errorMessage: `Text extraction error: ${extractErr.message}`,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, id));

      return NextResponse.json(
        { error: `Extraction failed: ${extractErr.message}` },
        { status: 422 }
      );
    }

    // 5. Save structured extracted data to isolated storage
    const extractedPayload = {
      documentId: doc.id,
      userId,
      filename: doc.filename,
      fileType: doc.fileType,
      text: extractedResult.text,
      pageCount: extractedResult.pageCount,
      pages: extractedResult.pages,
      metadata: extractedResult.metadata,
    };

    await saveExtractedData(extractedPayload, doc.id, userId);

    // 6. Mark document as 'completed'
    const [updatedDoc] = await db
      .update(documents)
      .set({
        processingStatus: "completed",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Document processed and text extracted successfully.",
      document: updatedDoc,
      metadata: extractedResult.metadata,
      pageCount: extractedResult.pageCount,
      preview: extractedResult.text.substring(0, 300),
    });
  } catch (error) {
    console.error("POST /api/documents/:id/process error:", error);
    return NextResponse.json(
      { error: "Internal server error during document processing." },
      { status: 500 }
    );
  }
}
