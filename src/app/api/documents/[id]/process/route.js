import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
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
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "ingest", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Processing rate limit exceeded. Please wait before retrying.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
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
    let result;
    try {
      result = await executeDocumentProcessing({ document: doc });
    } catch (error) {
      console.error("Document processing failed:", error);
      return NextResponse.json(
        { error: error.message || "Processing failed" },
        { status: 500 }
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    // 3. Fetch and return updated document record
    const [updatedDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));

    const response = NextResponse.json({
      success: true,
      message: "Document processed, chunked, and embedded successfully.",
      document: toClientSafeDocument(updatedDoc, access),
      chunksCount: result.chunksCount,
      embeddingModel: EMBEDDING_MODEL,
      embeddingDimensions: EXPECTED_DIMENSIONS,
    });

    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
