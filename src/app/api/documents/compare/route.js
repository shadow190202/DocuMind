import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  documents,
  documentChunks,
  documentComparisons,
  aiUsageLogs,
} from "@/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  compareDocumentsRequestSchema,
  getComparisonQuerySchema,
} from "@/lib/validations/comparison";
import { generateDocumentComparison, CHAT_MODEL } from "@/lib/ai/gemini";
import { verifyDualDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/compare
 * Generates or retrieves a cached grounded document comparison between two documents.
 *
 * Invariants & Requirements:
 * 1. Clerk Authentication: Enforces authenticated session; returns 401 if unauthenticated.
 * 2. Strict Dual Access Control: verifyDualDocumentAccess(read) runs BEFORE cache check.
 *    Returns uniform 404 if either document is missing or unauthorized.
 * 3. Processing Status: Both documents must have processingStatus === 'completed'.
 * 4. Cache Efficiency: If regenerate === false and a cached comparison exists, returns it
 *    without calling Gemini or burning free-tier quota.
 * 5. Safe Regeneration: Gemini call executes first. If it fails for ANY reason (429, timeout, network),
 *    the existing cached comparison in the database is strictly PRESERVED intact.
 * 6. Dual-Mode Scalability: Automatically runs Direct mode (<= 12 chunks each) or Hybrid Semantic Alignment (> 12 chunks).
 * 7. Usage Tracking: On generation, records operation: 'compare' in ai_usage_logs under requesting collaborator's user ID.
 */
export async function POST(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Parse and validate request body
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validation = compareDocumentsRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sourceDocumentId, targetDocumentId, regenerate } = validation.data;

    // 2. Authorize dual document access BEFORE inspecting comparison cache
    const dualAccess = await verifyDualDocumentAccess({
      sourceDocumentId,
      targetDocumentId,
      userId,
      requiredPermission: "read",
    });

    if (!dualAccess.authorized) {
      return dualAccess.errorResponse;
    }

    const sourceDoc = dualAccess.source.document;
    const targetDoc = dualAccess.target.document;

    if (
      sourceDoc.processingStatus !== "completed" ||
      targetDoc.processingStatus !== "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "Both documents must be processed before they can be compared.",
        },
        { status: 400 }
      );
    }

    // 3. Cache Check: Return existing comparison if regenerate is false
    if (!regenerate) {
      const [existingComparison] = await db
        .select()
        .from(documentComparisons)
        .where(
          and(
            eq(documentComparisons.sourceDocumentId, sourceDocumentId),
            eq(documentComparisons.targetDocumentId, targetDocumentId)
          )
        );

      if (existingComparison) {
        return NextResponse.json({
          success: true,
          comparison: existingComparison,
          cached: true,
          mode: "cached",
        });
      }
    }

    // 4. Fetch text chunks and embeddings for both documents
    const sourceChunks = await db
      .select({
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        pageNumber: documentChunks.pageNumber,
        embedding: documentChunks.embedding,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, sourceDocumentId))
      .orderBy(asc(documentChunks.chunkIndex));

    const targetChunks = await db
      .select({
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        pageNumber: documentChunks.pageNumber,
        embedding: documentChunks.embedding,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, targetDocumentId))
      .orderBy(asc(documentChunks.chunkIndex));

    if (sourceChunks.length === 0 || targetChunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "One or both documents have no text chunks available to compare.",
        },
        { status: 400 }
      );
    }

    // 5. Generate grounded comparison using Gemini 2.5 Flash
    // Safe Regeneration: If this fails, catch block exits and existing cached comparison remains intact!
    let generatedResult;
    try {
      generatedResult = await generateDocumentComparison({
        chunksA: sourceChunks,
        chunksB: targetChunks,
      });
    } catch (aiErr) {
      console.error("Gemini document comparison generation error:", aiErr);
      const isRateLimit = aiErr.isRateLimit || aiErr.status === 429;
      return NextResponse.json(
        {
          error: isRateLimit
            ? "Gemini free-tier rate limit reached. Please wait a few moments before trying again."
            : `AI document comparison failed: ${aiErr.message}`,
          isRateLimit,
        },
        { status: isRateLimit ? 429 : 502 }
      );
    }

    const { content, usage, mode } = generatedResult;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "AI model returned an empty comparison response." },
        { status: 502 }
      );
    }

    // 6. Safe Atomic Database Persistence (Upsert comparison + Log AI usage)
    const [savedComparison] = await db.transaction(async (tx) => {
      const [upserted] = await tx
        .insert(documentComparisons)
        .values({
          userId,
          sourceDocumentId,
          targetDocumentId,
          content,
          structuredData: null,
          model: CHAT_MODEL,
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          totalTokens: usage?.totalTokens ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            documentComparisons.sourceDocumentId,
            documentComparisons.targetDocumentId,
          ],
          set: {
            content,
            structuredData: null,
            model: CHAT_MODEL,
            promptTokens: usage?.promptTokens ?? null,
            completionTokens: usage?.completionTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      await tx.insert(aiUsageLogs).values({
        userId,
        model: CHAT_MODEL,
        operation: "compare",
        promptTokens: usage?.promptTokens ?? null,
        completionTokens: usage?.completionTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      });

      return [upserted];
    });

    return NextResponse.json({
      success: true,
      comparison: savedComparison,
      cached: false,
      mode,
    });
  } catch (error) {
    console.error("POST /api/documents/compare error:", error);
    return NextResponse.json(
      { error: "Internal server error during document comparison." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/compare
 * Retrieves a cached comparison for a document pair or lists recent comparisons for the user.
 *
 * Query Options:
 * - ?recent=true : Returns the user's 10 most recent comparisons with source/target filenames
 * - ?sourceId=<UUID>&targetId=<UUID> : Returns cached comparison for this specific directional pair
 */
export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawSourceId = searchParams.get("sourceId") || undefined;
    const rawTargetId = searchParams.get("targetId") || undefined;
    const rawRecent = searchParams.get("recent") || undefined;

    const validation = getComparisonQuerySchema.safeParse({
      sourceId: rawSourceId,
      targetId: rawTargetId,
      recent: rawRecent,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sourceId, targetId, recent } = validation.data;

    // Mode A: Retrieve user's recent comparison history
    if (recent === "true") {
      const sourceDocs = alias(documents, "source_docs");
      const targetDocs = alias(documents, "target_docs");

      const recentComparisons = await db
        .select({
          id: documentComparisons.id,
          sourceDocumentId: documentComparisons.sourceDocumentId,
          targetDocumentId: documentComparisons.targetDocumentId,
          sourceFilename: sourceDocs.filename,
          targetFilename: targetDocs.filename,
          model: documentComparisons.model,
          totalTokens: documentComparisons.totalTokens,
          createdAt: documentComparisons.createdAt,
          updatedAt: documentComparisons.updatedAt,
        })
        .from(documentComparisons)
        .innerJoin(
          sourceDocs,
          eq(documentComparisons.sourceDocumentId, sourceDocs.id)
        )
        .innerJoin(
          targetDocs,
          eq(documentComparisons.targetDocumentId, targetDocs.id)
        )
        .where(eq(documentComparisons.userId, userId))
        .orderBy(desc(documentComparisons.updatedAt))
        .limit(10);

      return NextResponse.json({
        success: true,
        comparisons: recentComparisons,
      });
    }

    // Mode B: Retrieve specific comparison by pair
    const dualAccess = await verifyDualDocumentAccess({
      sourceDocumentId: sourceId,
      targetDocumentId: targetId,
      userId,
      requiredPermission: "read",
    });

    if (!dualAccess.authorized) {
      return dualAccess.errorResponse;
    }

    const [comparison] = await db
      .select()
      .from(documentComparisons)
      .where(
        and(
          eq(documentComparisons.sourceDocumentId, sourceId),
          eq(documentComparisons.targetDocumentId, targetId)
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
    console.error("GET /api/documents/compare error:", error);
    return NextResponse.json(
      { error: "Internal server error retrieving document comparison." },
      { status: 500 }
    );
  }
}
