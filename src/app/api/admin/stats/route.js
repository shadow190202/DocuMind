import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import {
  users,
  documents,
  messages,
  conversations,
  aiUsageLogs,
} from "@/db/schema";
import { sql, and, gte } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { adminStatsQuerySchema } from "@/lib/validations/admin";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/stats
 * Administrative Telemetry & KPI Aggregation
 *
 * All metrics are calculated via single aggregated SQL queries.
 * Empty database datasets return deterministic numbers/empty arrays (never null, NaN, or Infinity).
 * Time-series results are chronologically sorted in ASC order.
 */
export async function GET(req) {
  try {
    const { userId } = await auth();
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

    // 1. Overall Platform Totals
    const [userCountRow] = await activeDb
      .select({ count: sql`COUNT(*)::int` })
      .from(users);
    const totalUsers = userCountRow?.count || 0;

    const [docStatsRow] = await activeDb
      .select({
        total: sql`COUNT(*)::int`,
        completed: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'completed' THEN 1 END)::int`,
        failed: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'failed' THEN 1 END)::int`,
        processing: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'processing' THEN 1 END)::int`,
        pending: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'pending' THEN 1 END)::int`,
        totalBytes: sql`COALESCE(SUM(${documents.fileSize}), 0)::bigint`,
      })
      .from(documents);

    const totalDocuments = docStatsRow?.total || 0;
    const completedDocs = docStatsRow?.completed || 0;
    const failedDocs = docStatsRow?.failed || 0;
    const processingDocs = docStatsRow?.processing || 0;
    const pendingDocs = docStatsRow?.pending || 0;
    const storageUsageBytes = Number(docStatsRow?.totalBytes || 0);

    const resolvedProcessed = completedDocs + failedDocs;
    const processingSuccessRate =
      resolvedProcessed > 0
        ? Math.round((completedDocs / resolvedProcessed) * 1000) / 10
        : totalDocuments > 0
        ? 100.0
        : 0.0;

    // 2. Questions Total (messages with role = 'user')
    const [questionsRow] = await activeDb
      .select({ count: sql`COUNT(*)::int` })
      .from(messages)
      .where(sql`${messages.role} = 'user'`);
    const totalQuestions = questionsRow?.count || 0;

    // 3. AI Usage Grounded Totals (from ai_usage_logs)
    const [aiUsageStatsRow] = await activeDb
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::bigint`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::bigint`,
        operationsCount: sql`COUNT(*)::int`,
        tokensUnavailableCount: sql`COUNT(CASE WHEN ${aiUsageLogs.totalTokens} IS NULL THEN 1 END)::int`,
      })
      .from(aiUsageLogs);

    const recordedAiTokens = Number(aiUsageStatsRow?.totalTokens || 0);
    const recordedPromptTokens = Number(aiUsageStatsRow?.promptTokens || 0);
    const recordedCompletionTokens = Number(aiUsageStatsRow?.completionTokens || 0);
    const aiOperationsCount = aiUsageStatsRow?.operationsCount || 0;
    const tokensUnavailableCount = aiUsageStatsRow?.tokensUnavailableCount || 0;

    // 4. Active Users (distinct users active in the selected window)
    const activeWindowSql = dateThreshold ? sql`${dateThreshold.toISOString()}::timestamp` : sql`NOW() - INTERVAL '30 days'`;
    const [activeUsersRow] = await activeDb.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int AS active_count FROM (
        SELECT user_id FROM documents WHERE created_at >= ${activeWindowSql}
        UNION
        SELECT user_id FROM conversations WHERE created_at >= ${activeWindowSql}
        UNION
        SELECT user_id FROM ai_usage_logs WHERE created_at >= ${activeWindowSql}
      ) active_pool
    `);
    const activeUsers = Number(activeUsersRow?.[0]?.active_count || activeUsersRow?.active_count || 0);

    // 5. Time-Series: Document Uploads over time (Chronological ASC)
    const uploadsQuery = dateThreshold
      ? sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM documents
          WHERE created_at >= ${dateThreshold.toISOString()}::timestamp
          GROUP BY 1
          ORDER BY 1 ASC
        `
      : sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM documents
          GROUP BY 1
          ORDER BY 1 ASC
        `;
    const rawUploads = await activeDb.execute(uploadsQuery);
    const uploadsTimeline = Array.isArray(rawUploads)
      ? rawUploads.map((r) => ({ date: r.day, count: Number(r.count) }))
      : [];

    // 6. Time-Series: Questions asked over time (Chronological ASC)
    const questionsTimelineQuery = dateThreshold
      ? sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM messages
          WHERE role = 'user' AND created_at >= ${dateThreshold.toISOString()}::timestamp
          GROUP BY 1
          ORDER BY 1 ASC
        `
      : sql`
          SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
          FROM messages
          WHERE role = 'user'
          GROUP BY 1
          ORDER BY 1 ASC
        `;
    const rawQuestions = await activeDb.execute(questionsTimelineQuery);
    const questionsTimeline = Array.isArray(rawQuestions)
      ? rawQuestions.map((r) => ({ date: r.day, count: Number(r.count) }))
      : [];

    // 7. Document Formats Breakdown
    const rawFormats = await activeDb
      .select({
        fileType: documents.fileType,
        count: sql`COUNT(*)::int`,
        bytes: sql`COALESCE(SUM(${documents.fileSize}), 0)::bigint`,
      })
      .from(documents)
      .groupBy(documents.fileType);

    const documentTypes = rawFormats.map((f) => ({
      fileType: f.fileType,
      count: Number(f.count),
      bytes: Number(f.bytes),
    }));

    const response = NextResponse.json({
      success: true,
      timeRange,
      kpis: {
        totalUsers,
        activeUsers,
        totalDocuments,
        completedDocs,
        failedDocs,
        processingDocs,
        pendingDocs,
        processingSuccessRate,
        totalQuestions,
        storageUsageBytes,
        aiUsage: {
          recordedTokens: recordedAiTokens,
          promptTokens: recordedPromptTokens,
          completionTokens: recordedCompletionTokens,
          operationsCount: aiOperationsCount,
          tokensUnavailableCount,
          quotaDisclaimer:
            "DocuMind-observed usage only. Google Gemini provider quota limits are managed independently in Google Cloud Console.",
        },
      },
      charts: {
        uploadsTimeline,
        questionsTimeline,
        documentTypes,
        processingStatus: [
          { status: "completed", count: completedDocs },
          { status: "processing", count: processingDocs },
          { status: "failed", count: failedDocs },
          { status: "pending", count: pendingDocs },
        ],
      },
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
