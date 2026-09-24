import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentSummaries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSummaryQuerySchema } from "@/lib/validations/summary";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/summary
 * Retrieves cached summaries for a document owned by the authenticated user.
 *
 * Invariants:
 * 1. Clerk Authentication: Enforces authenticated session; returns 401 if unauthenticated.
 * 2. Strict Tenant Isolation: Queries WHERE id = :id AND user_id = :userId.
 *    Returns uniform 404 for unowned or missing documents.
 * 3. Zero AI Overhead: Pure database retrieval; zero Gemini API calls, zero token usage.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    // 1. Verify document ownership
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get("type") || undefined;
    const validation = getSummaryQuerySchema.safeParse({ type: rawType });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { type } = validation.data;

    // 3. Query cached summaries
    const conditions = [
      eq(documentSummaries.documentId, id),
      eq(documentSummaries.userId, userId),
    ];

    if (type && type !== "all") {
      conditions.push(eq(documentSummaries.summaryType, type));
    }

    const summaries = await db
      .select()
      .from(documentSummaries)
      .where(and(...conditions))
      .orderBy(documentSummaries.createdAt);

    return NextResponse.json({
      documentId: id,
      summaries,
    });
  } catch (error) {
    console.error("GET /api/documents/:id/summary error:", error);
    return NextResponse.json(
      { error: "Internal server error retrieving document summaries." },
      { status: 500 }
    );
  }
}
