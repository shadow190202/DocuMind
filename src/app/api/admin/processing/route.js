import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { documents, users } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/processing
 * Processing Pipeline & Ingestion Failure Diagnostics
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

    const activeDb = db || getDb();
    if (!activeDb) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    // 1. Ingestion queue metrics
    const [countsRow] = await activeDb
      .select({
        total: sql`COUNT(*)::int`,
        completed: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'completed' THEN 1 END)::int`,
        failed: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'failed' THEN 1 END)::int`,
        processing: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'processing' THEN 1 END)::int`,
        pending: sql`COUNT(CASE WHEN ${documents.processingStatus} = 'pending' THEN 1 END)::int`,
      })
      .from(documents);

    const total = countsRow?.total || 0;
    const completed = countsRow?.completed || 0;
    const failed = countsRow?.failed || 0;
    const processing = countsRow?.processing || 0;
    const pending = countsRow?.pending || 0;

    // 2. Fetch failed documents with error diagnostics (ordered by most recent failure)
    const failedDocsRaw = await activeDb
      .select({
        id: documents.id,
        filename: documents.filename,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        processingStatus: documents.processingStatus,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        ownerId: documents.userId,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .where(eq(documents.processingStatus, "failed"))
      .orderBy(desc(documents.updatedAt))
      .limit(50);

    const failedDocuments = failedDocsRaw.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      errorMessage: doc.errorMessage || "Unknown ingestion failure.",
      createdAt: doc.createdAt,
      failedAt: doc.updatedAt,
      owner: {
        id: doc.ownerId,
        name: doc.ownerName || null,
        email: doc.ownerEmail || null,
      },
    }));

    // 3. Fetch currently in-flight processing documents
    const inFlightDocsRaw = await activeDb
      .select({
        id: documents.id,
        filename: documents.filename,
        fileType: documents.fileType,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .where(eq(documents.processingStatus, "processing"))
      .orderBy(desc(documents.updatedAt))
      .limit(20);

    const activeJobs = inFlightDocsRaw.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      startedAt: doc.updatedAt,
      owner: {
        name: doc.ownerName || null,
        email: doc.ownerEmail || null,
      },
    }));

    const response = NextResponse.json({
      success: true,
      queue: {
        total,
        completed,
        failed,
        processing,
        pending,
        successRate:
          completed + failed > 0
            ? Math.round((completed / (completed + failed)) * 1000) / 10
            : total > 0
            ? 100.0
            : 0.0,
      },
      failedDocuments,
      activeJobs,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
