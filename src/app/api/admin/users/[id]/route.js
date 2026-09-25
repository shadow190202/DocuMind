import { NextResponse } from "next/server";
import { db, getDb } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { verifyAdminAccess } from "@/lib/auth/admin";
import { updateUserRoleSchema } from "@/lib/validations/admin";
import { assertValidOrigin } from "@/lib/auth/csrf";
import { checkRateLimit, applyRateLimitHeaders } from "@/lib/rate-limiter";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/:id
 * Concurrency-Safe Administrator Role Update
 *
 * Mandatory Security Invariants:
 * 1. Independent Server-Side Admin Authorization (DB role === 'admin').
 * 2. Self-Demotion Block: Calling administrator cannot demote their own account.
 * 3. Concurrency-Safe Last-Admin Protection: Atomically locks admin rows (FOR UPDATE)
 *    and guarantees >= 1 administrator remains.
 */
export async function PATCH(req, { params }) {
  try {
    assertValidOrigin(req);

    const { userId } = await auth();
    const adminCheck = await verifyAdminAccess(userId);
    if (!adminCheck.authorized) {
      return adminCheck.errorResponse;
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
    const targetUserId = resolvedParams?.id || params?.id;
    if (!targetUserId) {
      return NextResponse.json({ error: "Target User ID is required." }, { status: 400 });
    }

    const body = await req.json();
    const parseResult = updateUserRoleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed.", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { role: newRole } = parseResult.data;
    const callerUserId = adminCheck.userId;

    // Invariant 2: Self-Demotion Prevention
    if (targetUserId === callerUserId && newRole !== "admin") {
      return NextResponse.json(
        { error: "Administrators cannot demote their own account. Another administrator must perform this action." },
        { status: 400 }
      );
    }

    const activeDb = db || getDb();
    if (!activeDb) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    let updatedUser;
    try {
      updatedUser = await activeDb.transaction(async (tx) => {
        // Fetch target user with lock
        const [targetUser] = await tx
          .select({
            id: users.id,
            email: users.email,
            role: users.role,
          })
          .from(users)
          .where(eq(users.id, targetUserId))
          .for("update");

        if (!targetUser) {
          throw new Error("USER_NOT_FOUND");
        }

        // Invariant 3: Concurrency-Safe Last-Admin Protection
        // If demoting an existing administrator to 'user', serialize check across all admins
        if (targetUser.role === "admin" && newRole !== "admin") {
          const adminRows = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.role, "admin"))
            .for("update");

          if (adminRows.length <= 1) {
            throw new Error("SOLE_ADMIN_DEMOTION_FORBIDDEN");
          }
        }

        const [saved] = await tx
          .update(users)
          .set({
            role: newRole,
            updatedAt: new Date(),
          })
          .where(eq(users.id, targetUserId))
          .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            updatedAt: users.updatedAt,
          });

        return saved;
      });
    } catch (txError) {
      if (txError.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
      }
      if (txError.message === "SOLE_ADMIN_DEMOTION_FORBIDDEN") {
        return NextResponse.json(
          {
            error:
              "Cannot demote the sole remaining administrator. The platform must maintain at least one active administrator.",
          },
          { status: 400 }
        );
      }
      throw txError;
    }

    const response = NextResponse.json({
      success: true,
      message: `User role successfully updated to '${newRole}'.`,
      user: updatedUser,
    });
    return applyRateLimitHeaders(response, rateLimit);
  } catch (error) {
    return handleApiError(error, req);
  }
}
