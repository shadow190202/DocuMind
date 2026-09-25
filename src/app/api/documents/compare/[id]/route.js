import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentComparisons } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid({ message: "Invalid comparison ID format. Must be a valid UUID." });

/**
 * GET /api/documents/compare/:id
 * Retrieves a single document comparison by ID for the authenticated owner.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
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
      .where(
        and(
          eq(documentComparisons.id, id),
          eq(documentComparisons.userId, userId)
        )
      );

    if (!comparison) {
      return NextResponse.json(
        { error: "Comparison not found or access denied." },
        { status: 404 }
      );
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
 *
 * Invariants:
 * 1. Clerk Authentication: Returns 401 if unauthenticated.
 * 2. Strict Tenant Isolation: Deletes strictly WHERE id = :id AND user_id = :userId.
 * 3. Idempotent / Safe 404: Returns 404 if comparison does not exist or belongs to another user.
 */
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const validation = idSchema.safeParse(id);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid comparison ID format." },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: documentComparisons.id })
      .from(documentComparisons)
      .where(
        and(
          eq(documentComparisons.id, id),
          eq(documentComparisons.userId, userId)
        )
      );

    if (!existing) {
      return NextResponse.json(
        { error: "Comparison not found or access denied." },
        { status: 404 }
      );
    }

    await db
      .delete(documentComparisons)
      .where(
        and(
          eq(documentComparisons.id, id),
          eq(documentComparisons.userId, userId)
        )
      );

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
