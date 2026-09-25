import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { users, documents, messages, conversations, aiUsageLogs } from "@/db/schema";
import { sql, eq, and, or, ilike, desc, asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { adminUsersQuerySchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Paginated User Directory with Activity Aggregations (Zero N+1)
 */
export async function GET(req) {
  try {
    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const parsedQuery = adminUsersQuerySchema.safeParse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      search: searchParams.get("search") || "",
      role: searchParams.get("role") || "all",
      sortBy: searchParams.get("sortBy") || "recent",
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters.", details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, search, role, sortBy } = parsedQuery.data;
    const offset = (page - 1) * limit;

    const activeDb = db || getDb();

    // Build WHERE conditions
    const conditions = [];
    if (role !== "all") {
      conditions.push(eq(users.role, role));
    }
    if (search) {
      conditions.push(
        or(
          ilike(users.name, `%${search}%`),
          ilike(users.email, `%${search}%`),
          eq(users.id, search)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Get total user count matching filter
    const [countResult] = await activeDb
      .select({ count: sql`COUNT(*)::int` })
      .from(users)
      .where(whereClause);
    const totalUsers = countResult?.count || 0;
    const totalPages = Math.ceil(totalUsers / limit);

    // 2. Fetch paginated users with activity aggregations in a single query
    // Use correlated subqueries to avoid cross-product row multiplication
    const userRows = await activeDb
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        documentCount: sql`(
          SELECT COUNT(*)::int FROM documents d WHERE d.user_id = ${users.id}
        )`,
        questionsCount: sql`(
          SELECT COUNT(*)::int 
          FROM messages m 
          JOIN conversations c ON c.id = m.conversation_id 
          WHERE c.user_id = ${users.id} AND m.role = 'user'
        )`,
        tokensUsed: sql`(
          SELECT COALESCE(SUM(l.total_tokens), 0)::bigint 
          FROM ai_usage_logs l 
          WHERE l.user_id = ${users.id}
        )`,
      })
      .from(users)
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    // Sort in-memory or by SQL
    let sortedUsers = [...userRows];
    if (sortBy === "recent") {
      sortedUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "oldest") {
      sortedUsers.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === "name") {
      sortedUsers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "documents") {
      sortedUsers.sort((a, b) => Number(b.documentCount) - Number(a.documentCount));
    } else if (sortBy === "questions") {
      sortedUsers.sort((a, b) => Number(b.questionsCount) - Number(a.questionsCount));
    } else if (sortBy === "tokens") {
      sortedUsers.sort((a, b) => Number(b.tokensUsed) - Number(a.tokensUsed));
    }

    const sanitizedUsers = sortedUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      stats: {
        documentCount: Number(u.documentCount || 0),
        questionsCount: Number(u.questionsCount || 0),
        tokensUsed: Number(u.tokensUsed || 0),
      },
    }));

    return NextResponse.json({
      success: true,
      users: sanitizedUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
