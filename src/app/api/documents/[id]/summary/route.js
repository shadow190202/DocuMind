import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import { documentSummaries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSummaryQuerySchema } from "@/lib/validations/summary";
import { verifyDocumentAccess } from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/summary
 * Retrieves cached summaries for a document.
 */
export async function GET(req, { params }) {
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
            message: "Rate limit exceeded. Please slow down.",
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
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    // 1. Authorize access BEFORE inspecting summary cache
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get("type") || undefined;
    const validation = getSummaryQuerySchema.safeParse({ type: rawType });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type } = validation.data;

    // 3. Query cached summaries for this document
    const conditions = [
      eq(documentSummaries.documentId, id),
    ];

    if (type && type !== "all") {
      conditions.push(eq(documentSummaries.summaryType, type));
    }

    const summaries = await db
      .select()
      .from(documentSummaries)
      .where(and(...conditions))
      .orderBy(documentSummaries.createdAt);

    const response = NextResponse.json({
      documentId: id,
      summaries,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
