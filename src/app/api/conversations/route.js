import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { db } from "@/db";
import { conversations, messages, documents } from "@/db/schema";
import { eq, and, sql, count, ilike, gte, asc, desc } from "drizzle-orm";
import { listConversationsQuerySchema } from "@/lib/validations/conversation";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations
 * Lists conversations for the authenticated user.
 */
export async function GET(req) {
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

    const { searchParams } = new URL(req.url);
    const rawQuery = {
      search: searchParams.get("search") || undefined,
      documentId: searchParams.get("documentId") || undefined,
      timeRange: searchParams.get("timeRange") || undefined,
      sort: searchParams.get("sort") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    };

    const validation = listConversationsQuerySchema.safeParse(rawQuery);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { search, documentId, timeRange, sort, limit, offset } = validation.data;

    // 1. Build WHERE conditions
    const conditions = [eq(conversations.userId, userId)];

    if (documentId) {
      conditions.push(eq(conversations.documentId, documentId));
    }

    if (search && search.trim().length > 0) {
      conditions.push(ilike(conversations.title, `%${search.trim()}%`));
    }

    if (timeRange && timeRange !== "all") {
      let cutoff;
      const now = Date.now();
      if (timeRange === "24h") {
        cutoff = new Date(now - 24 * 60 * 60 * 1000);
      } else if (timeRange === "7d") {
        cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === "30d") {
        cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
      }
      if (cutoff) {
        conditions.push(gte(conversations.updatedAt, cutoff));
      }
    }

    // 2. Count total matching conversations for pagination
    const [totalResult] = await db
      .select({ total: count(conversations.id) })
      .from(conversations)
      .where(and(...conditions));
    const total = Number(totalResult?.total || 0);

    // 3. Determine server-side ORDER BY clause
    let orderClause;
    switch (sort) {
      case "oldest":
        orderClause = asc(conversations.createdAt);
        break;
      case "most_questions":
        orderClause = desc(
          sql`COUNT(CASE WHEN ${messages.role} = 'user' THEN 1 END)`
        );
        break;
      case "title":
        orderClause = asc(conversations.title);
        break;
      case "recent":
      default:
        orderClause = desc(conversations.updatedAt);
        break;
    }

    // 4. Execute single aggregated query (Zero N+1 queries)
    const rawConversations = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        documentId: conversations.documentId,
        documentName: documents.filename,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        messageCount: sql`COUNT(${messages.id})::integer`,
        questionCount: sql`COUNT(CASE WHEN ${messages.role} = 'user' THEN 1 END)::integer`,
        lastMessageSnippet: sql`(
          SELECT ${messages.content} 
          FROM ${messages} 
          WHERE ${messages.conversationId} = ${conversations.id} 
          ORDER BY ${messages.createdAt} DESC 
          LIMIT 1
        )`,
        lastMessageRole: sql`(
          SELECT ${messages.role} 
          FROM ${messages} 
          WHERE ${messages.conversationId} = ${conversations.id} 
          ORDER BY ${messages.createdAt} DESC 
          LIMIT 1
        )`,
      })
      .from(conversations)
      .leftJoin(documents, eq(conversations.documentId, documents.id))
      .leftJoin(messages, eq(conversations.id, messages.conversationId))
      .where(and(...conditions))
      .groupBy(
        conversations.id,
        conversations.title,
        conversations.documentId,
        documents.filename,
        conversations.createdAt,
        conversations.updatedAt
      )
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    const formattedConversations = rawConversations.map((c) => ({
      id: c.id,
      title: c.title,
      documentId: c.documentId,
      documentName: c.documentName || null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: Number(c.messageCount || 0),
      questionCount: Number(c.questionCount || 0),
      lastMessageSnippet: c.lastMessageSnippet || null,
      lastMessageRole: c.lastMessageRole || null,
    }));

    const response = NextResponse.json({
      success: true,
      conversations: formattedConversations,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + formattedConversations.length < total,
      },
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
