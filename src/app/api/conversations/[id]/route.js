import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import { conversations, messages, documents } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { updateConversationSchema } from "@/lib/validations/conversation";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/:id
 * Retrieves a conversation and its messages with source citations.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "general", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please slow down.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const [conv] = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        documentName: documents.filename,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .leftJoin(documents, eq(conversations.documentId, documents.id))
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found or access denied." },
        { status: 404 }
      );
    }

    const conversationMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        sources: messages.sources,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    const response = NextResponse.json({
      success: true,
      conversation: conv,
      messages: conversationMessages,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * PATCH /api/conversations/:id
 * Renames a conversation title.
 */
export async function PATCH(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "mutation", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please slow down.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const validation = updateConversationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title } = validation.data;

    const [updated] = await db
      .update(conversations)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Conversation not found or access denied." },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      conversation: updated,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation and cascades message deletion in PostgreSQL.
 */
export async function DELETE(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await getAuthSession(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, "mutation", userId);
    if (!rateLimit.success) {
      return applyRateLimitHeaders(
        NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please slow down.",
            retryAfter: rateLimit.retryAfter,
          },
          { status: 429 }
        ),
        rateLimit
      );
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning({ id: conversations.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found or access denied." },
        { status: 404 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Conversation deleted successfully.",
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
