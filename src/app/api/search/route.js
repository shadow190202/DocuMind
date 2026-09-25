import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchRequestSchema } from "@/lib/validations/search";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/search
 * Vault-wide or multi-document semantic vector search.
 */
export async function POST(req) {
  try {
    const { userId } = await auth();
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

    const body = await req.json();

    const validation = searchRequestSchema.safeParse(body);
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
      documentId,
      documentIds,
      includeContext,
      maxContextTokens,
    } = validation.data;

    const results = await searchDocumentChunks({
      query,
      userId,
      documentId,
      documentIds,
      topK,
      threshold,
    });

    const responsePayload = {
      success: true,
      query,
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
