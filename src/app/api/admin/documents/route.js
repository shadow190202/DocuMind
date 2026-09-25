import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { documents, users, documentChunks } from "@/db/schema";
import { sql, eq, and, or, ilike, desc, asc } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { adminDocumentsQuerySchema } from "@/lib/validations/admin";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/documents
 * Global Document Surveillance (All Tenants)
 *
 * Mandatory Invariants:
 * 1. Independent Server-Side Admin Authorization.
 * 2. Strictly omits storageUrl and internal filesystem paths.
 * 3. Supports filtering by processing_status, file_type, and search.
 */
export async function GET(req) {
  try {
    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
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
    const parsedQuery = adminDocumentsQuerySchema.safeParse({
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
      search: searchParams.get("search") || "",
      status: searchParams.get("status") || "all",
      fileType: searchParams.get("fileType") || "all",
      sortBy: searchParams.get("sortBy") || "recent",
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters.", details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const { page, limit, search, status, fileType, sortBy } = parsedQuery.data;
    const offset = (page - 1) * limit;

    const activeDb = db || getDb();

    // Build WHERE clause
    const conditions = [];
    if (status !== "all") {
      conditions.push(eq(documents.processingStatus, status));
    }
    if (fileType !== "all") {
      conditions.push(eq(documents.fileType, fileType));
    }
    if (search) {
      conditions.push(
        or(
          ilike(documents.filename, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.name, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 1. Total matching count
    const [countRow] = await activeDb
      .select({ count: sql`COUNT(*)::int` })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .where(whereClause);

    const totalDocs = countRow?.count || 0;
    const totalPages = Math.ceil(totalDocs / limit);

    // 2. Fetch documents joined with owner metadata
    // Exclude storageUrl completely
    let orderColumn = desc(documents.createdAt);
    if (sortBy === "oldest") {
      orderColumn = asc(documents.createdAt);
    } else if (sortBy === "name") {
      orderColumn = asc(documents.filename);
    } else if (sortBy === "size") {
      orderColumn = desc(documents.fileSize);
    }

    const docRows = await activeDb
      .select({
        id: documents.id,
        filename: documents.filename,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        processingStatus: documents.processingStatus,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        ownerId: documents.userId,
        ownerName: users.name,
        ownerEmail: users.email,
        chunksCount: sql`(SELECT COUNT(*)::int FROM document_chunks dc WHERE dc.document_id = ${documents.id})`,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.userId))
      .where(whereClause)
      .orderBy(orderColumn)
      .limit(limit)
      .offset(offset);

    // Format client-safe representation
    const sanitizedDocs = docRows.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      processingStatus: doc.processingStatus,
      errorMessage: doc.errorMessage || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunksCount: Number(doc.chunksCount || 0),
      owner: {
        id: doc.ownerId,
        name: doc.ownerName || null,
        email: doc.ownerEmail || null,
      },
    }));

    const response = NextResponse.json({
      success: true,
      documents: sanitizedDocs,
      pagination: {
        page,
        limit,
        total: totalDocs,
        totalPages,
      },
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
