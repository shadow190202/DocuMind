import { NextResponse } from "next/server";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Public, minimal liveness probe for container orchestrators, uptime monitors,
 * and load balancers.
 *
 * Security & Operational Invariants:
 * - Publicly accessible without authentication.
 * - Minimal response payload: { status: "healthy", timestamp: ... }.
 * - Strictly ZERO disclosure of database version, pgvector version, connection details,
 *   storage paths, file statistics, or environment configurations.
 * - Rate-limited to prevent probe flooding.
 */
export async function GET(req) {
  try {
    const rateLimit = checkRateLimit(req, "general");
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Health check rate limit exceeded.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    const response = NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });

    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
