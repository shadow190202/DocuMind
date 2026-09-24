import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { searchRequestSchema } from "@/lib/validations/search";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/search
 * Vault-wide or multi-document semantic vector search.
 *
 * Invariants & Requirements:
 * 1. Requires Clerk user authentication (returns 401 if unauthenticated).
 * 2. Strictly validates request body with Zod schema (returns 400 on error).
 * 3. Enforces multi-tenant isolation at the database query level.
 * 4. Threshold filtering applied before LIMIT.
 * 5. Returns cosine similarity (1 - distance), never exposing raw vector embeddings.
 * 6. Optionally includes assembled RAG prompt context when includeContext=true.
 */
export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const validation = searchRequestSchema.safeParse(body);
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
      documentId,
      documentIds,
      includeContext,
      maxContextTokens,
    } = validation.data;

    const results = await searchDocumentChunks({
      query,
      userId,
      documentId,
      documentIds,
      topK,
      threshold,
    });

    const responsePayload = {
      success: true,
      query,
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
    console.error("POST /api/search error:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error performing vector search.",
      },
      { status: 500 }
    );
  }
}
