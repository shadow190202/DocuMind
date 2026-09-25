import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { deleteFile, deleteExtractedData } from "@/lib/storage";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/documents/:id
 * Administrative Document Deletion
 *
 * Invariants & Guarantees:
 * 1. Independent Server-Side Admin Authorization.
 * 2. Cascades deletion to chunks, conversations, summaries, comparisons, and permissions via DB FKs.
 * 3. Deletes physical files from storage.
 * 4. Preserves platform-level ai_usage_logs (which are tenant audit telemetry, not document data).
 */
export async function DELETE(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
    }

    const rateLimit = checkRateLimit(req, "mutation", userId);
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

    const [doc] = await activeDb
      .select({
        id: documents.id,
        userId: documents.userId,
        storageUrl: documents.storageUrl,
      })
      .from(documents)
      .where(eq(documents.id, documentId));

    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 1. Delete physical files from disk
    try {
      await deleteFile(doc.storageUrl);
    } catch (storageErr) {
      console.warn(`File deletion warning for doc ${documentId}:`, storageErr.message);
    }

    try {
      await deleteExtractedData(doc.id, doc.userId);
    } catch (extractedErr) {
      console.warn(`Extracted data deletion warning for doc ${documentId}:`, extractedErr.message);
    }

    // 2. Delete database record (cascades to chunks, summaries, comparisons, permissions, conversations)
    // Note: ai_usage_logs is intentionally preserved for platform-level audit telemetry
    await activeDb.delete(documents).where(eq(documents.id, documentId));

    const response = NextResponse.json({
      success: true,
      message: "Document deleted successfully.",
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
