import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentComparisons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyDualDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid({ message: "Invalid comparison ID format. Must be a valid UUID." });

/**
 * GET /api/documents/compare/:id
 * Retrieves a single document comparison by ID.
 *
 * MANDATORY CACHE AUTHORIZATION ORDER:
 * 1. Authenticate user.
 * 2. Fetch comparison row.
 * 3. Verify read access to BOTH source and target documents.
 *    If either document is inaccessible or access was revoked -> return 404.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error) {
    console.error("GET /api/documents/compare/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error retrieving document comparison." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/compare/:id
 * Deletes a cached document comparison.
 * Authorized for comparison creator or owner of either document.
 */
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      message: "Comparison deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/documents/compare/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting document comparison." },
      { status: 500 }
    );
  }
}
