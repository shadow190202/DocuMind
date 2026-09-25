import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentSummaries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSummaryQuerySchema } from "@/lib/validations/summary";
import { verifyDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/summary
 * Retrieves cached summaries for a document.
 *
 * MANDATORY CACHE AUTHORIZATION ORDER:
 * 1. Authenticate user.
 * 2. Run verifyDocumentAccess(read).
 * 3. Reject unauthorized or unshared users with uniform 404 (preventing cache inference).
 * 4. Only then query document_summaries cache.
 * 5. Return cached summaries (0 Gemini calls, 0 token cost).
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    // 1. Authorize access BEFORE inspecting summary cache
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
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

    // 3. Query cached summaries for this document
    const conditions = [
      eq(documentSummaries.documentId, id),
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
