import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { aiUsageLogs, documents } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage
 * Returns verified AI token usage and Document Vault capacity for the authenticated user.
 */
export async function GET(req) {
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
            message: "Rate limit exceeded. Please slow down.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    // 1. Query aggregated AI usage stats for authenticated user
    const [usageResult] = await db
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::integer`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::integer`,
        operationsCount: count(aiUsageLogs.id),
        chatQuestionsCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'chat' THEN 1 END)::integer`,
        summariesCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'summarize' THEN 1 END)::integer`,
        comparisonsCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'compare' THEN 1 END)::integer`,
        tokensUnavailableCount: sql`COUNT(CASE WHEN ${aiUsageLogs.totalTokens} IS NULL THEN 1 END)::integer`,
        lastUsedAt: sql`MAX(${aiUsageLogs.createdAt})`,
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, userId));

    // 2. Query Document Vault document count for authenticated user
    const [docResult] = await db
      .select({
        documentCount: count(documents.id),
      })
      .from(documents)
      .where(eq(documents.userId, userId));

    const MAX_DOCUMENTS = 50;
    const documentCount = Number(docResult?.documentCount || 0);
    const vaultPercentage = Math.min(
      100,
      Math.round((documentCount / MAX_DOCUMENTS) * 100)
    );

    const operationsCount = Number(usageResult?.operationsCount || 0);
    const chatQuestionsCount = Number(usageResult?.chatQuestionsCount || 0);
    const summariesCount = Number(usageResult?.summariesCount || 0);
    const comparisonsCount = Number(usageResult?.comparisonsCount || 0);
    const tokensUnavailableCount = Number(
      usageResult?.tokensUnavailableCount || 0
    );

    const response = NextResponse.json({
      success: true,
      aiUsage: {
        totalTokens: Number(usageResult?.totalTokens || 0),
        promptTokens: Number(usageResult?.promptTokens || 0),
        completionTokens: Number(usageResult?.completionTokens || 0),
        operationsCount,
        requestsCount: operationsCount,
        questionsCount: operationsCount, // Maintained for backward compatibility
        chatQuestionsCount,
        summariesCount,
        comparisonsCount,
        tokensUnavailableCount,
        hasUnavailableTokenCounts: tokensUnavailableCount > 0,
        lastUsedAt: usageResult?.lastUsedAt || null,
      },
      vaultUsage: {
        documentCount,
        maxDocuments: MAX_DOCUMENTS,
        percentage: vaultPercentage,
      },
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
