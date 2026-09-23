import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { eq, and, asc, isNotNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/chunks
 * Retrieves all stored chunks for an authorized document.
 * Omits raw 768-float vector arrays to protect bandwidth and prevent exposure.
 */
export async function GET(req, { params }) {
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

    // 2. Fetch chunks ordered deterministically by chunk_index
    const rawChunks = await db
      .select({
        id: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        createdAt: documentChunks.createdAt,
        hasEmbedding: isNotNull(documentChunks.embedding),
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, id))
      .orderBy(asc(documentChunks.chunkIndex));

    // 3. Format chunks with character and estimated token counts
    const chunks = rawChunks.map((c) => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
      content: c.content,
      pageNumber: c.pageNumber,
      characterCount: c.content?.length || 0,
      estimatedTokenCount: Math.ceil((c.content?.length || 0) / 4),
      hasEmbedding: Boolean(c.hasEmbedding),
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        fileType: doc.fileType,
        processingStatus: doc.processingStatus,
      },
      totalChunks: chunks.length,
      embeddingModel: "gemini-embedding-001",
      embeddingDimensions: 768,
      chunks,
    });
  } catch (error) {
    console.error("GET /api/documents/:id/chunks error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching document chunks." },
      { status: 500 }
    );
  }
}
