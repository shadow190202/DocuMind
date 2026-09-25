import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { aiUsageLogs, users } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { getAuthSession } from "@/lib/auth/session";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { adminStatsQuerySchema } from "@/lib/validations/admin";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/usage
 * Grounded AI Usage Analytics & Consumer Leaderboard
 *
 * Mandatory Semantic Guarantees (Phase 9.5 & 14):
 * 1. Only sums actual recorded tokens where total_tokens IS NOT NULL.
 * 2. Never claims 0 for unrecorded embedding calls; represents metadata as unavailable.
 * 3. Preserves official provider quota independence disclaimer.
 */
export async function GET(req) {
  try {
    const { userId } = await getAuthSession(req);
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
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

    const { searchParams } = new URL(req.url);
    const parsedQuery = adminStatsQuerySchema.safeParse({
      timeRange: searchParams.get("timeRange") || "30d",
    });
    const timeRange = parsedQuery.success ? parsedQuery.data.timeRange : "30d";

    let dateThreshold = null;
    const now = new Date();
    if (timeRange === "7d") {
      dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "30d") {
      dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "90d") {
      dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    const activeDb = db || getDb();
    if (!activeDb) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    // 1. Overall Aggregations
    const [overallRow] = await activeDb
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::bigint`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::bigint`,
        operationsCount: sql`COUNT(*)::int`,
        tokensUnavailableCount: sql`COUNT(CASE WHEN ${aiUsageLogs.totalTokens} IS NULL THEN 1 END)::int`,
        chatCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'chat' THEN 1 END)::int`,
        summarizeCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'summarize' THEN 1 END)::int`,
        compareCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'compare' THEN 1 END)::int`,
      })
      .from(aiUsageLogs);

    // 2. Breakdown by Model
    const modelRows = await activeDb
      .select({
        model: aiUsageLogs.model,
        operations: sql`COUNT(*)::int`,
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::bigint`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::bigint`,
      })
      .from(aiUsageLogs)
      .groupBy(aiUsageLogs.model);

    const modelBreakdown = modelRows.map((m) => ({
      model: m.model,
      operations: Number(m.operations),
      totalTokens: Number(m.totalTokens),
      promptTokens: Number(m.promptTokens),
      completionTokens: Number(m.completionTokens),
    }));

    // 3. Top Active Consumers Leaderboard
    const topConsumersRows = await activeDb
      .select({
        userId: aiUsageLogs.userId,
        userName: users.name,
        userEmail: users.email,
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::bigint`,
        operationsCount: sql`COUNT(*)::int`,
        chatCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'chat' THEN 1 END)::int`,
        summarizeCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'summarize' THEN 1 END)::int`,
        compareCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'compare' THEN 1 END)::int`,
        lastActive: sql`MAX(${aiUsageLogs.createdAt})`,
      })
      .from(aiUsageLogs)
      .leftJoin(users, eq(users.id, aiUsageLogs.userId))
      .groupBy(aiUsageLogs.userId, users.name, users.email)
      .orderBy(desc(sql`SUM(${aiUsageLogs.totalTokens})`))
      .limit(10);

    const topConsumers = topConsumersRows.map((c) => ({
      userId: c.userId,
      name: c.userName || "Unnamed User",
      email: c.userEmail || "No Email",
      totalTokens: Number(c.totalTokens),
      operationsCount: Number(c.operationsCount),
      chatCount: Number(c.chatCount),
      summarizeCount: Number(c.summarizeCount),
      compareCount: Number(c.compareCount),
      lastActive: c.lastActive,
    }));

    // 4. Daily Token Timeline (Chronological ASC)
    const tokenTimelineQuery = dateThreshold
      ? sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
                 COUNT(*)::int AS operations
          FROM ai_usage_logs
          WHERE created_at >= ${dateThreshold.toISOString()}::timestamp
          GROUP BY 1
          ORDER BY 1 ASC
        `
      : sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COALESCE(SUM(total_tokens), 0)::bigint AS tokens,
                 COUNT(*)::int AS operations
          FROM ai_usage_logs
          GROUP BY 1
          ORDER BY 1 ASC
        `;

    const rawTimeline = await activeDb.execute(tokenTimelineQuery);
    const tokenTimeline = Array.isArray(rawTimeline)
      ? rawTimeline.map((r) => ({
          date: r.day,
          tokens: Number(r.tokens),
          operations: Number(r.operations),
        }))
      : [];

    const response = NextResponse.json({
      success: true,
      timeRange,
      summary: {
        recordedTokens: Number(overallRow?.totalTokens || 0),
        promptTokens: Number(overallRow?.promptTokens || 0),
        completionTokens: Number(overallRow?.completionTokens || 0),
        operationsCount: Number(overallRow?.operationsCount || 0),
        tokensUnavailableCount: Number(overallRow?.tokensUnavailableCount || 0),
        chatCount: Number(overallRow?.chatCount || 0),
        summarizeCount: Number(overallRow?.summarizeCount || 0),
        compareCount: Number(overallRow?.compareCount || 0),
        embeddingTelemetryNote:
          "Token metadata is not exposed by the Gemini gemini-embedding-001 API. Embedding operations are tracked without fabricated token counts.",
        disclaimer:
          "DocuMind-observed usage only. Google Gemini provider quota limits are managed independently in Google Cloud Console.",
      },
      modelBreakdown,
      topConsumers,
      tokenTimeline,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
