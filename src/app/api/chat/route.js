import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, conversations, messages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { chatRequestSchema } from "@/lib/validations/chat";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";
import { generateGroundedAnswer } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

const INSUFFICIENT_CONTEXT_MESSAGE =
  "No relevant passages were found in your document(s) matching this question with sufficient similarity. Try lowering the similarity threshold or rephrasing your question.";

/**
 * POST /api/chat
 * Grounded AI Question Answering with Gemini 2.5 Flash & pgvector retrieval.
 *
 * Invariants & Requirements:
 * 1. Clerk Authentication: Enforces authenticated user session (returns 401 if unauthenticated).
 * 2. Zod Validation: Validates all request parameters with strict boundary limits.
 * 3. Strict Tenant Isolation: Verifies document and conversation ownership (uniform 404 for unauthorized).
 * 4. Zero-Result Cost Optimization: Skips calling Gemini entirely when 0 chunks meet similarity threshold.
 * 5. Free-Tier Rate-Limit Handling: Returns clear 429 status on quota/rate limits without aggressive retries.
 * 6. Grounded Answering: Answers generated exclusively from retrieved document chunks.
 * 7. Persistence: Atomically saves conversation, user message, and assistant message with JSONB sources.
 * 8. Zero Vector Exposure: Never leaks raw embedding vectors.
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

    const validation = chatRequestSchema.safeParse(body);
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
      question,
      documentId,
      conversationId,
      topK,
      threshold,
      maxContextTokens,
    } = validation.data;

    // 1. If documentId is provided, verify document exists and is owned by authenticated user
    let scopedDocument = null;
    if (documentId) {
      const [doc] = await db
        .select({
          id: documents.id,
          userId: documents.userId,
          filename: documents.filename,
          processingStatus: documents.processingStatus,
        })
        .from(documents)
        .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

      // Uniform 404 prevents document enumeration across tenants
      if (!doc) {
        return NextResponse.json(
          { error: "Document not found or access denied." },
          { status: 404 }
        );
      }

      if (doc.processingStatus !== "completed") {
        return NextResponse.json(
          {
            error: `Document is not ready for question answering. Current status: ${doc.processingStatus}.`,
          },
          { status: 400 }
        );
      }

      scopedDocument = doc;
    }

    // 2. If conversationId is provided, verify conversation exists and is owned by authenticated user
    let existingConversation = null;
    if (conversationId) {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, userId)
          )
        );

      // Uniform 404 prevents conversation enumeration across tenants
      if (!conv) {
        return NextResponse.json(
          { error: "Conversation not found or access denied." },
          { status: 404 }
        );
      }

      existingConversation = conv;
    }

    // 3. Perform vector retrieval using Phase 8 engine
    const retrievedChunks = await searchDocumentChunks({
      query: question,
      userId,
      documentId: documentId || undefined,
      topK,
      threshold,
    });

    // 4. Handle Zero-Result condition (Free-tier cost & quota optimization)
    // If 0 chunks met similarity threshold, do NOT invoke Gemini!
    if (!retrievedChunks || retrievedChunks.length === 0) {
      const result = await db.transaction(async (tx) => {
        let activeConvId = conversationId;
        if (!activeConvId) {
          const title =
            question.length > 60 ? `${question.slice(0, 57)}...` : question;
          const [newConv] = await tx
            .insert(conversations)
            .values({
              userId,
              documentId: documentId || null,
              title,
            })
            .returning({ id: conversations.id });
          activeConvId = newConv.id;
        } else {
          await tx
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, activeConvId));
        }

        const [userMsg] = await tx
          .insert(messages)
          .values({
            conversationId: activeConvId,
            role: "user",
            content: question,
          })
          .returning({ id: messages.id, createdAt: messages.createdAt });

        const [assistantMsg] = await tx
          .insert(messages)
          .values({
            conversationId: activeConvId,
            role: "assistant",
            content: INSUFFICIENT_CONTEXT_MESSAGE,
            sources: [],
          })
          .returning({ id: messages.id, createdAt: messages.createdAt });

        return {
          conversationId: activeConvId,
          userMessageId: userMsg.id,
          assistantMessageId: assistantMsg.id,
        };
      });

      return NextResponse.json({
        success: true,
        conversationId: result.conversationId,
        userMessageId: result.userMessageId,
        assistantMessageId: result.assistantMessageId,
        question,
        answer: INSUFFICIENT_CONTEXT_MESSAGE,
        sources: [],
        contextSummary: {
          totalEstimatedTokens: 0,
          chunksUsed: 0,
          chunksOmitted: 0,
        },
        insufficientContext: true,
      });
    }

    // 5. Assemble RAG context using Phase 8 assembler
    const {
      contextText,
      sources,
      totalEstimatedTokens,
      chunksUsed,
      chunksOmitted,
    } = assembleRagContext(retrievedChunks, { maxContextTokens });

    // 6. Generate grounded answer using Gemini 2.5 Flash
    let answerText;
    try {
      answerText = await generateGroundedAnswer({
        question,
        contextText,
      });
    } catch (aiError) {
      if (aiError.isRateLimit || aiError.status === 429) {
        return NextResponse.json(
          {
            error:
              "Gemini free-tier rate limit reached. Please wait a few moments before asking another question.",
          },
          { status: 429 }
        );
      }
      throw aiError;
    }

    // 7. Persist conversation, user message, and assistant answer atomically
    const saved = await db.transaction(async (tx) => {
      let activeConvId = conversationId;
      if (!activeConvId) {
        const title =
          question.length > 60 ? `${question.slice(0, 57)}...` : question;
        const [newConv] = await tx
          .insert(conversations)
          .values({
            userId,
            documentId: documentId || null,
            title,
          })
          .returning({ id: conversations.id });
        activeConvId = newConv.id;
      } else {
        await tx
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, activeConvId));
      }

      const [userMsg] = await tx
        .insert(messages)
        .values({
          conversationId: activeConvId,
          role: "user",
          content: question,
        })
        .returning({ id: messages.id, createdAt: messages.createdAt });

      const [assistantMsg] = await tx
        .insert(messages)
        .values({
          conversationId: activeConvId,
          role: "assistant",
          content: answerText,
          sources: sources,
        })
        .returning({ id: messages.id, createdAt: messages.createdAt });

      return {
        conversationId: activeConvId,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg.id,
      };
    });

    return NextResponse.json({
      success: true,
      conversationId: saved.conversationId,
      userMessageId: saved.userMessageId,
      assistantMessageId: saved.assistantMessageId,
      question,
      answer: answerText,
      sources,
      contextSummary: {
        totalEstimatedTokens,
        chunksUsed,
        chunksOmitted,
      },
      insufficientContext: false,
    });
  } catch (error) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json(
      {
        error:
          error.message || "An unexpected error occurred while answering your question.",
      },
      { status: error.status || 500 }
    );
  }
}
