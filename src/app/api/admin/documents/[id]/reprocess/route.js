import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { documents, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { executeDocumentProcessing } from "@/lib/document-processor";
import { toClientSafeDocument } from "@/lib/auth/permissions";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/documents/:id/reprocess
 * Administrative Document Reprocessing
 *
 * Mandatory Invariants:
 * 1. Independent Server-Side Admin Authorization.
 * 2. Reuses authoritative Phase 5-7 processing pipeline (executeDocumentProcessing).
 * 3. Uses DOCUMENT OWNER'S userId for storage and extracted paths (never admin ID).
 * 4. Transactionally replaces chunks and invalidates summaries and comparisons.
 * 5. Returns client-safe document metadata; never exposes storageUrl.
 */
export async function POST(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
    }

    const rateLimit = checkRateLimit(req, "ingest", userId);
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
    const documentId = resolvedParams?.id || params?.id;
    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    const activeDb = db || getDb();
    if (!activeDb) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    // 1. Fetch document record
    const [doc] = await activeDb
      .select({
        id: documents.id,
        userId: documents.userId,
        filename: documents.filename,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        storageUrl: documents.storageUrl,
        processingStatus: documents.processingStatus,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .where(eq(documents.id, documentId));

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 2. Execute authoritative ingestion pipeline under owner's storage identity
    const result = await executeDocumentProcessing({ document: doc });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reprocess document." },
        { status: result.status || 500 }
      );
    }

    // 3. Fetch updated document record
    const [updatedDoc] = await activeDb
      .select({
        id: documents.id,
        userId: documents.userId,
        filename: documents.filename,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        processingStatus: documents.processingStatus,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.id, documentId));

    const safeDoc = {
      id: updatedDoc.id,
      filename: updatedDoc.filename,
      fileType: updatedDoc.fileType,
      fileSize: updatedDoc.fileSize,
      processingStatus: updatedDoc.processingStatus,
      errorMessage: updatedDoc.errorMessage || null,
      createdAt: updatedDoc.createdAt,
      updatedAt: updatedDoc.updatedAt,
      owner: {
        id: doc.userId,
        name: doc.ownerName || null,
        email: doc.ownerEmail || null,
      },
    };

    const response = NextResponse.json({
      success: true,
      message: "Document reprocessed and derived caches invalidated successfully.",
      document: safeDoc,
      chunksCount: result.chunksCount,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
