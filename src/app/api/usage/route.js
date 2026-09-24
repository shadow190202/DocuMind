import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { aiUsageLogs, documents } from "@/db/schema";
import { eq, sql, count } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/usage
 * Returns verified AI token usage and Document Vault capacity for the authenticated user.
 *
 * Invariants & Requirements:
 * 1. Clerk Authentication: Enforces authenticated session; returns 401 if unauthenticated.
 * 2. Strict Tenant Isolation: Aggregates strictly WHERE userId = :userId. Never leaks another user's data.
 * 3. Honest Metrics: Distinguishes between recorded tokens and questions with unavailable metadata.
 * 4. Clean Zeroes: Returns zero counters cleanly for brand new users without errors.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Query aggregated AI usage stats for authenticated user
    const [usageResult] = await db
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::integer`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::integer`,
        questionsCount: count(aiUsageLogs.id),
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

    const questionsCount = Number(usageResult?.questionsCount || 0);
    const tokensUnavailableCount = Number(
      usageResult?.tokensUnavailableCount || 0
    );

    return NextResponse.json({
      success: true,
      aiUsage: {
        totalTokens: Number(usageResult?.totalTokens || 0),
        promptTokens: Number(usageResult?.promptTokens || 0),
        completionTokens: Number(usageResult?.completionTokens || 0),
        questionsCount,
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
  } catch (error) {
    console.error("GET /api/usage error:", error);
    return NextResponse.json(
      {
        error:
          error.message || "Failed to retrieve usage statistics.",
      },
      { status: 500 }
    );
  }
}
