import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { searchRequestSchema } from "@/lib/validations/search";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";
import { verifyDocumentAccess } from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/search
 * Single-document semantic vector search.
 */
export async function POST(req, { params }) {
  try {
    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "general", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Search rate limit exceeded. Please slow down.",
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
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    // 1. Verify document access & status
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const doc = access.document;

    if (doc.processingStatus !== "completed") {
      return NextResponse.json(
        {
          error: `Document is not ready for search. Current status: ${doc.processingStatus}.`,
        },
        { status: 400 }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json();

    const validation = searchRequestSchema.safeParse({
      ...body,
      documentId: id,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      query,
      topK,
      threshold,
      includeContext,
      maxContextTokens,
    } = validation.data;

    // 3. Perform vector search scoped to this document
    const results = await searchDocumentChunks({
      query,
      userId,
      documentId: id,
      topK,
      threshold,
    });

    const responsePayload = {
      success: true,
      query,
      documentId: id,
      documentName: doc.filename,
      count: results.length,
      topK,
      threshold,
      results,
    };

    if (includeContext) {
      responsePayload.context = assembleRagContext(results, {
        maxContextTokens,
      });
    }

    const response = NextResponse.json(responsePayload);
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
