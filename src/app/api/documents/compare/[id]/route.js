import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import { documentComparisons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyDualDocumentAccess } from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid({ message: "Invalid comparison ID format. Must be a valid UUID." });

/**
 * GET /api/documents/compare/:id
 * Retrieves a single document comparison by ID.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await getAuthSession(req);
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
    const validation = idSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid comparison ID format." },
        { status: 400 }
      );
    }

    const [comparison] = await db
      .select()
      .from(documentComparisons)
      .where(eq(documentComparisons.id, id));

    if (!comparison) {
      return NextResponse.json(
        { error: "Comparison not found or access denied." },
        { status: 404 }
      );
    }

    // Verify dual document access: user must have active read access to both documents
    const dualAccess = await verifyDualDocumentAccess({
      sourceDocumentId: comparison.sourceDocumentId,
      targetDocumentId: comparison.targetDocumentId,
      userId,
      requiredPermission: "read",
    });

    if (!dualAccess.authorized) {
      return dualAccess.errorResponse;
    }

    const response = NextResponse.json({
      success: true,
      comparison,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * DELETE /api/documents/compare/:id
 * Deletes a cached document comparison.
 */
export async function DELETE(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
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
    const validation = idSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid comparison ID format." },
        { status: 400 }
      );
    }

    const [comparison] = await db
      .select()
      .from(documentComparisons)
      .where(eq(documentComparisons.id, id));

    if (!comparison) {
      return NextResponse.json(
        { error: "Comparison not found or access denied." },
        { status: 404 }
      );
    }

    const isCreator = comparison.userId === userId;
    const dualAccess = await verifyDualDocumentAccess({
      sourceDocumentId: comparison.sourceDocumentId,
      targetDocumentId: comparison.targetDocumentId,
      userId,
      requiredPermission: "read",
    });

    const isDocOwner =
      dualAccess.authorized &&
      (dualAccess.source.isOwner || dualAccess.target.isOwner);

    if (!isCreator && !isDocOwner) {
      return NextResponse.json(
        { error: "Only the comparison creator or a document owner can delete this comparison." },
        { status: 403 }
      );
    }

    await db
      .delete(documentComparisons)
      .where(eq(documentComparisons.id, id));

    const response = NextResponse.json({
      success: true,
      message: "Comparison deleted successfully.",
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
