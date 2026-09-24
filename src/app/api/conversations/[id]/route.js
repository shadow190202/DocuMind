import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, messages, documents } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { updateConversationSchema } from "@/lib/validations/conversation";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations/:id
 * Retrieves a conversation and its messages with source citations.
 * Enforces strict user ownership (uniform 404 if unauthorized or non-existent).
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

    return NextResponse.json({
      success: true,
      conversation: conv,
      messages: conversationMessages,
    });
  } catch (error) {
    console.error("GET /api/conversations/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching conversation." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/:id
 * Renames a conversation title.
 * Enforces strict user ownership (uniform 404 if unauthorized or non-existent).
 */
export async function PATCH(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json(
        { error: "Conversation ID is required." },
        { status: 400 }
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

    return NextResponse.json({
      success: true,
      conversation: updated,
    });
  } catch (error) {
    console.error("PATCH /api/conversations/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error updating conversation." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation and cascades message deletion in PostgreSQL.
 */
export async function DELETE(req, { params }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE /api/conversations/:id error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting conversation." },
      { status: 500 }
    );
  }
}
