import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, documentChunks, documentSummaries, aiUsageLogs } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { summarizeRequestSchema } from "@/lib/validations/summary";
import { generateDocumentSummary, CHAT_MODEL } from "@/lib/ai/gemini";
import { verifyDocumentAccess } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/documents/:id/summarize
 * Generates or retrieves a cached grounded document summary.
 *
 * Invariants & Requirements:
 * 1. Clerk Authentication: Enforces authenticated session; returns 401 if unauthenticated.
 * 2. Strict Access Control: verifyDocumentAccess(read) runs BEFORE cache inspection.
 *    Returns uniform 404 for unauthorized documents (preventing cache inference).
 * 3. Processing Status: Document must have processingStatus === 'completed'.
 * 4. Cache Efficiency: If regenerate === false and a cached summary exists, returns it
 *    without calling Gemini or burning free-tier quota.
 * 5. Safe Regeneration: Gemini call executes first. If it fails for ANY reason (429, timeout, network),
 *    the existing cached summary in the database is strictly PRESERVED intact.
 * 6. Dual-Mode Scalability: Automatically runs Direct mode (<= 12 chunks) or Map -> Reduce (> 12 chunks).
 * 7. Usage Tracking: On generation, records operation: 'summarize' in ai_usage_logs with verified token metadata
 *    under the requesting collaborator's user ID.
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
      return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
    }

    // 1. Parse and validate request body
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const validation = summarizeRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { summaryType, regenerate } = validation.data;

    // 2. Verify document access & processing status BEFORE cache check
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "read",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const doc = access.document;

    if (doc.processingStatus !== "completed") {
      return NextResponse.json(
        {
          error: `Document cannot be summarized because its processing status is '${doc.processingStatus}'. Please process the document first.`,
        },
        { status: 400 }
      );
    }

    // 3. Cache Check: Return existing summary if regenerate is false
    if (!regenerate) {
      const [existingSummary] = await db
        .select()
        .from(documentSummaries)
        .where(
          and(
            eq(documentSummaries.documentId, id),
            eq(documentSummaries.summaryType, summaryType)
          )
        );

      if (existingSummary) {
        return NextResponse.json({
          success: true,
          summary: existingSummary,
          cached: true,
          mode: "cached",
        });
      }
    }

    // 4. Fetch existing document chunks ordered by chunkIndex ASC
    const chunks = await db
      .select({
        content: documentChunks.content,
        chunkIndex: documentChunks.chunkIndex,
        pageNumber: documentChunks.pageNumber,
      })
      .from(documentChunks)
      .where(eq(documentChunks.documentId, id))
      .orderBy(asc(documentChunks.chunkIndex));

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: "Document has no text chunks available to summarize." },
        { status: 400 }
      );
    }

    // 5. Generate summary using Gemini 2.5 Flash (Direct or Map -> Reduce)
    // Critical: If this fails, the catch block exits and existing cached summary is preserved!
    let generatedResult;
    try {
      generatedResult = await generateDocumentSummary({
        chunks,
        summaryType,
      });
    } catch (aiErr) {
      console.error("Gemini summarization generation error:", aiErr);
      const isRateLimit = aiErr.isRateLimit || aiErr.status === 429;
      return NextResponse.json(
        {
          error: isRateLimit
            ? "Gemini free-tier rate limit reached. Please wait a few moments before trying again."
            : `AI summarization failed: ${aiErr.message}`,
          isRateLimit,
        },
        { status: isRateLimit ? 429 : 502 }
      );
    }

    const { content, usage, mode } = generatedResult;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "AI model returned an empty summary response." },
        { status: 502 }
      );
    }

    // 6. Safe Atomic Database Persistence (Upsert summary + Log AI usage)
    const [savedSummary] = await db.transaction(async (tx) => {
      const [upserted] = await tx
        .insert(documentSummaries)
        .values({
          documentId: id,
          userId,
          summaryType,
          content,
          structuredData: null,
          model: CHAT_MODEL,
          promptTokens: usage?.promptTokens ?? null,
          completionTokens: usage?.completionTokens ?? null,
          totalTokens: usage?.totalTokens ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [documentSummaries.documentId, documentSummaries.summaryType],
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
        operation: "summarize",
        promptTokens: usage?.promptTokens ?? null,
        completionTokens: usage?.completionTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      });

      return [upserted];
    });

    return NextResponse.json({
      success: true,
      summary: savedSummary,
      cached: false,
      mode,
    });
  } catch (error) {
    console.error("POST /api/documents/:id/summarize error:", error);
    return NextResponse.json(
      { error: "Internal server error during document summarization." },
      { status: 500 }
    );
  }
}
