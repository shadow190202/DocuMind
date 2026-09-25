import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { documentPermissions, users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { shareDocumentSchema } from "@/lib/validations/permission";
import { verifyDocumentAccess } from "@/lib/auth/permissions";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/documents/:id/permissions
 * Retrieves the owner and collaborator list for a document.
 * Only the document owner can inspect collaborators.
 */
export async function GET(req, { params }) {
  try {
    const { userId } = await auth();
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
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Owner authorization required
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "owner",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const collaborators = await db
      .select({
        id: documentPermissions.id,
        documentId: documentPermissions.documentId,
        userId: documentPermissions.userId,
        permission: documentPermissions.permission,
        createdAt: documentPermissions.createdAt,
        updatedAt: documentPermissions.updatedAt,
        name: users.name,
        email: users.email,
      })
      .from(documentPermissions)
      .innerJoin(users, eq(users.id, documentPermissions.userId))
      .where(eq(documentPermissions.documentId, id))
      .orderBy(desc(documentPermissions.createdAt));

    const response = NextResponse.json({
      owner: {
        id: access.document.userId,
        name: access.document.ownerName || null,
        email: access.document.ownerEmail || null,
      },
      collaborators,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}

/**
 * POST /api/documents/:id/permissions
 * Shares a document with a collaborator by email.
 * Only the document owner can share.
 */
export async function POST(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
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
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    // Owner authorization required
    const access = await verifyDocumentAccess({
      documentId: id,
      userId,
      requiredPermission: "owner",
    });

    if (!access.authorized) {
      return access.errorResponse;
    }

    const body = await req.json();

    const validation = shareDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed.",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, permission } = validation.data;

    // Resolve target collaborator from registered users
    const [targetUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(sql`LOWER(${users.email}) = LOWER(${email})`);

    if (!targetUser) {
      return NextResponse.json(
        {
          error: `No DocuMind user found with email '${email}'. Please ask them to sign in to DocuMind first.`,
        },
        { status: 404 }
      );
    }

    // Authoritatively reject self-sharing based on resolved targetUser.id
    if (targetUser.id === access.document.userId) {
      return NextResponse.json(
        { error: "You cannot share a document with yourself." },
        { status: 400 }
      );
    }

    const now = new Date();

    // Deterministic upsert: if already shared, update role and advance updatedAt
    const [record] = await db
      .insert(documentPermissions)
      .values({
        documentId: id,
        userId: targetUser.id,
        permission,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [documentPermissions.documentId, documentPermissions.userId],
        set: {
          permission,
          updatedAt: now,
        },
      })
      .returning();

    const response = NextResponse.json(
      {
        permission: {
          id: record.id,
          documentId: record.documentId,
          userId: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          permission: record.permission,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        message: "Document shared successfully.",
      },
      { status: 201 }
    );
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
