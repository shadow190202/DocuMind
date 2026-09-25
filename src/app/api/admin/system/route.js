import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import {
  users,
  documents,
  documentChunks,
  conversations,
  messages,
  aiUsageLogs,
  documentSummaries,
  documentComparisons,
  documentPermissions,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/system
 * Hardened Operational Diagnostics & Infrastructure Telemetry
 *
 * Mandatory Security Safeguards:
 * 1. Independent Server-Side Admin Authorization.
 * 2. Strictly ZERO exposure of API keys, Clerk secrets, or DATABASE_URL.
 * 3. Strictly ZERO exposure of local filesystem absolute paths or storage URLs.
 * 4. Queries live pgvector extension version dynamically from PostgreSQL.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
    }

    const activeDb = db || getDb();
    if (!activeDb) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    // 1. Measure live database latency
    const pingStart = Date.now();
    await activeDb.execute(sql`SELECT 1`);
    const latencyMs = Date.now() - pingStart;

    // 2. Query actual installed pgvector version dynamically
    let pgvectorVersion = "unknown";
    let isPgvectorInstalled = false;
    try {
      const extResult = await activeDb.execute(
        sql`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
      );
      const rows = Array.isArray(extResult) ? extResult : extResult?.rows || [];
      if (rows.length > 0) {
        isPgvectorInstalled = true;
        pgvectorVersion = rows[0].extversion || "installed";
      }
    } catch (extErr) {
      console.warn("Could not query pg_extension:", extErr.message);
    }

    // 3. Storage Diagnostics (calculated from database without exposing filesystem paths)
    const [storageStats] = await activeDb
      .select({
        docCount: sql`COUNT(*)::int`,
        totalBytes: sql`COALESCE(SUM(${documents.fileSize}), 0)::bigint`,
      })
      .from(documents);

    const totalBytes = Number(storageStats?.totalBytes || 0);
    const formattedStorage =
      totalBytes > 1024 * 1024 * 1024
        ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : totalBytes > 1024 * 1024
        ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`
        : totalBytes > 1024
        ? `${(totalBytes / 1024).toFixed(2)} KB`
        : `${totalBytes} Bytes`;

    // 4. Application Tables Row Counts
    const [
      usersCount,
      docsCount,
      chunksCount,
      convsCount,
      msgsCount,
      aiLogsCount,
      summariesCount,
      comparisonsCount,
      permissionsCount,
    ] = await Promise.all([
      activeDb.select({ count: sql`COUNT(*)::int` }).from(users),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(documents),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(documentChunks),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(conversations),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(messages),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(aiUsageLogs),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(documentSummaries),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(documentComparisons),
      activeDb.select({ count: sql`COUNT(*)::int` }).from(documentPermissions),
    ]);

    const tableRowCounts = {
      users: usersCount[0]?.count || 0,
      documents: docsCount[0]?.count || 0,
      documentChunks: chunksCount[0]?.count || 0,
      conversations: convsCount[0]?.count || 0,
      messages: msgsCount[0]?.count || 0,
      aiUsageLogs: aiLogsCount[0]?.count || 0,
      documentSummaries: summariesCount[0]?.count || 0,
      documentComparisons: comparisonsCount[0]?.count || 0,
      documentPermissions: permissionsCount[0]?.count || 0,
    };

    // 5. Sanitized Environment Presence Flags (Strictly booleans, never values!)
    const environmentStatus = {
      nodeEnv: process.env.NODE_ENV || "development",
      isDatabaseConfigured: Boolean(process.env.DATABASE_URL),
      isGeminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      isClerkConfigured: Boolean(
        process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      ),
    };

    return NextResponse.json({
      success: true,
      database: {
        status: "connected",
        latencyMs,
      },
      pgvector: {
        installed: isPgvectorInstalled,
        version: pgvectorVersion,
        expectedEmbeddingDimensions: 768,
      },
      storage: {
        totalDocuments: storageStats?.docCount || 0,
        totalSizeBytes: totalBytes,
        formattedSize: formattedStorage,
      },
      environment: environmentStatus,
      tableRowCounts,
    });
  } catch (error) {
    console.error("GET /api/admin/system error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
