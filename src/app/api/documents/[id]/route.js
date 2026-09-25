import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { deleteFile, deleteExtractedData } from "@/lib/storage";
import {
  verifyDocumentAccess,
  toClientSafeDocument,
} from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id
 * Retrieves document details for an authorized viewer, editor, or owner.
 * Server-only data safety: storageUrl is stripped.
 */
export async function GET(req, { params }) {
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

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const response = NextResponse.json({
      document: toClientSafeDocument(access.document, access),
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * DELETE /api/documents/:id
 * Deletes a document, its physical storage, extracted data, and DB cascades.
 * Strictly restricted to the document OWNER.
 */
export async function DELETE(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Owner authorization strictly required
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "owner",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const doc = access.document;

    // Delete from storage using owner storage path
    if (doc.storageUrl) {
      await deleteFile(doc.storageUrl);
    }
    await deleteExtractedData(id, doc.userId);

    // Delete from database (cascades to chunks, permissions, summaries, comparisons)
    await db.delete(documents).where(eq(documents.id, id));

    const response = NextResponse.json({
      message: "Document deleted successfully.",
      id,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
