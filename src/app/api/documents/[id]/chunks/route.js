import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentChunks } from "@/db/schema";
import { eq, asc, isNotNull } from "drizzle-orm";
import { verifyDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/chunks
 * Retrieves all stored chunks for an authorized document.
 * Authorized for Owner, Editor, and Viewer.
 * Omits raw 768-float vector arrays to protect bandwidth and prevent exposure.
 */
export async function GET(req, { params }) {
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

    // 1. Verify read access
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
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
      hasEmbedding: c.hasEmbedding,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      chunks,
      totalChunks: chunks.length,
      documentId: id,
    });
  } catch (error) {
    console.error("GET /api/documents/:id/chunks error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching document chunks." },
      { status: 500 }
    );
  }
}
