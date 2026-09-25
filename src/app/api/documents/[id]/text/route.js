import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getExtractedData } from "@/lib/storage";
import {
  verifyDocumentAccess,
  toClientSafeDocument,
} from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/text
 * Retrieves the extracted text, pages, and metadata for a processed document.
 * Authorized for Owner, Editor, and Viewer.
 * Storage retrieval uses the document owner's user ID.
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

    const doc = access.document;

    // MANDATORY STORAGE REQUIREMENT:
    // Extracted text is keyed by the document owner's user ID in storage.
    const extractedData = await getExtractedData(id, doc.userId);

    const safeDoc = toClientSafeDocument(doc, access);

    if (!extractedData) {
      const response = NextResponse.json({
        document: safeDoc,
        extracted: null,
        message: "No extracted text available for this document yet.",
      });
      return applyRateLimitHeaders(response, rateLimit);
    }

    const response = NextResponse.json({
      document: safeDoc,
      extracted: extractedData,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
