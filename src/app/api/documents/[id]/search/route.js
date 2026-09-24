import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { searchRequestSchema } from "@/lib/validations/search";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/search
 * Single-document semantic vector search.
 *
 * Invariants & Requirements:
 * 1. Requires Clerk user authentication (returns 401 if unauthenticated).
 * 2. Uniform 404 for non-existent documents and documents belonging to other users.
 * 3. Enforces that document processing status is 'completed'.
 * 4. Strictly validates request body with Zod schema (returns 400 on error).
 * 5. Pre-LIMIT threshold filtering.
 * 6. Cosine similarity = 1 - distance; zero raw vector exposure.
 * 7. Optional RAG context assembly when includeContext=true.
 */
export async function POST(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    // 1. Verify document ownership & status
    const [doc] = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        filename: documents.filename,
        fileType: documents.fileType,
        processingStatus: documents.processingStatus,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));

    // Uniform 404 for unauthorized or non-existent document
    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      );
    }

    if (doc.processingStatus !== "completed") {
      return NextResponse.json(
        {
          error: `Document is not ready for search. Current status: ${doc.processingStatus}.`,
        },
        { status: 400 }
      );
    }

    // 2. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = searchRequestSchema.safeParse({
      ...body,
      documentId: id,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      query,
      topK,
      threshold,
      includeContext,
      maxContextTokens,
    } = validation.data;

    // 3. Perform vector search scoped to this document
    const results = await searchDocumentChunks({
      query,
      userId,
      documentId: id,
      topK,
      threshold,
    });

    const responsePayload = {
      success: true,
      query,
      documentId: id,
      documentName: doc.filename,
      count: results.length,
      topK,
      threshold,
      results,
    };

    if (includeContext) {
      responsePayload.context = assembleRagContext(results, {
        maxContextTokens,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("POST /api/documents/:id/search error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error performing vector search.",
      },
      { status: 500 }
    );
  }
}
