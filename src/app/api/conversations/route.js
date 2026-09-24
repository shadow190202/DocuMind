import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { conversations, documents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Lists conversations for the authenticated user.
 * Optional query parameter: ?documentId=<uuid>
 */
export async function GET(req) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    const conditions = [eq(conversations.userId, userId)];
    if (documentId) {
      conditions.push(eq(conversations.documentId, documentId));
    }

    const userConversations = await db
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
      .where(and(...conditions))
      .orderBy(desc(conversations.updatedAt));

    return NextResponse.json({
      success: true,
      conversations: userConversations,
    });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching conversations." },
      { status: 500 }
    );
  }
}
