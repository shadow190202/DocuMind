import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documents, conversations, messages, aiUsageLogs } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { chatRequestSchema } from "@/lib/validations/chat";
import { searchDocumentChunks } from "@/lib/ai/vector-search";
import { assembleRagContext } from "@/lib/ai/rag-context";
import { generateGroundedAnswer, CHAT_MODEL } from "@/lib/ai/gemini";
import { verifyDocumentAccess } from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const INSUFFICIENT_CONTEXT_MESSAGE =
  "No relevant passages were found in your document(s) matching this question with sufficient similarity. Try lowering the similarity threshold or rephrasing your question.";

/**
 * POST /api/chat
 * Grounded AI Question Answering with Gemini 2.5 Flash & pgvector retrieval.
 */
export async function POST(req) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "ai", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "AI operation rate limit exceeded. Please wait before retrying.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
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

    // 1. If documentId is provided, verify active read access
    let scopedDocument = null;
    if (documentId) {
      const access = await verifyDocumentAccess({
        documentId,
        userId,
        requiredPermission: "read",
      });

      if (!access.authorized) {
        return access.errorResponse;
      }

      if (access.document.processingStatus !== "completed") {
        return NextResponse.json(
          {
            error: `Document is not ready for question answering. Current status: ${access.document.processingStatus}.`,
          },
          { status: 400 }
        );
      }

      scopedDocument = access.document;
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

      // MANDATORY CONVERSATION SECURITY:
      // If conversation is linked to a document, verify current document access.
      // If document access was revoked, reject with 404 BEFORE vector search or Gemini call.
      if (conv.documentId) {
        const convDocAccess = await verifyDocumentAccess({
          documentId: conv.documentId,
          userId,
          requiredPermission: "read",
        });

        if (!convDocAccess.authorized) {
          return convDocAccess.errorResponse;
        }

        if (!scopedDocument) {
          scopedDocument = convDocAccess.document;
        }
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

    // 5b. Fetch bounded recent conversation history for conversational reference resolution
    let conversationHistoryText = null;
    if (conversationId) {
      const recentTurns = await db
        .select({
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(4);

      if (recentTurns.length > 0) {
        // Order chronologically (earliest to newest)
        const chronological = [...recentTurns].reverse();
        const formatted = chronological.map(
          (m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
        );
        let joined = formatted.join("\n\n");
        // Strictly cap at ~400 estimated tokens (approx 1,600 characters)
        if (joined.length > 1600) {
          joined = joined.slice(joined.length - 1600);
        }
        conversationHistoryText = joined;
      }
    }

    // 6. Generate grounded answer using Gemini 2.5 Flash
    let aiResponse;
    try {
      aiResponse = await generateGroundedAnswer({
        question,
        contextText,
        conversationHistoryText,
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

    const answerText = aiResponse?.answer || String(aiResponse);
    const aiUsage = aiResponse?.usage || null;

    // 7. Persist conversation, user message, assistant answer, and usage atomically
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

      // Atomically persist verified AI usage inside the transaction
      await tx.insert(aiUsageLogs).values({
        userId,
        model: CHAT_MODEL,
        operation: "chat",
        promptTokens: aiUsage?.promptTokens ?? null,
        completionTokens: aiUsage?.completionTokens ?? null,
        totalTokens: aiUsage?.totalTokens ?? null,
      });

      return {
        conversationId: activeConvId,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg.id,
      };
    });

    const response = NextResponse.json({
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
      usage: aiUsage
        ? {
            promptTokens: aiUsage.promptTokens,
            completionTokens: aiUsage.completionTokens,
            totalTokens: aiUsage.totalTokens,
            unavailable: Boolean(aiUsage.unavailable),
          }
        : null,
      insufficientContext: false,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
