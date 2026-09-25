import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeDocumentProcessing } from "@/lib/document-processor";
import {
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

    // 2. Execute authoritative processing pipeline under owner identity
    const result = await executeDocumentProcessing({ document: doc });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

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
