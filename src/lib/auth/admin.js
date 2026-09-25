import { db, getDb } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Authoritatively verifies that the requesting caller is an administrator.
 *
 * Core Architecture & Security Invariants:
 * 1. Clerk authentication establishes caller identity (userId) in route handlers.
 * 2. PostgreSQL users.role === "admin" is the SOLE runtime authorization source.
 * 3. Never authorizes through Clerk claims or metadata (resilient to stale JWTs).
 * 4. Never authorizes through ADMIN_EMAILS or runtime environment bypasses.
 * 5. Returns Response.json with 401 Unauthorized or 403 Forbidden on failure.
 *
 * @param {string} userId - Authenticated user ID (Clerk user ID)
 * @returns {Promise<{
 *   authorized: boolean,
 *   adminUser: Object | null,
 *   userId: string | null,
 *   errorResponse: Response | null
 * }>}
 */
export async function verifyAdminAccess(input) {
  const userId =
    typeof input === "string"
      ? input
      : typeof input === "object" && input !== null
      ? input.explicitUserId || input.userId
      : null;

  if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
    return {
      authorized: false,
      adminUser: null,
      userId: null,
      errorResponse: Response.json(
        { error: "Unauthorized: Authentication required." },
        { status: 401 }
      ),
    };
  }

  const activeDb = db || getDb();
  if (!activeDb) {
    return {
      authorized: false,
      adminUser: null,
      userId,
      errorResponse: Response.json(
        { error: "Database not configured." },
        { status: 503 }
      ),
    };
  }

  // Sole authoritative check: PostgreSQL users.role === "admin"
  const [dbUser] = await activeDb
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId.trim()));

  if (!dbUser || dbUser.role !== "admin") {
    return {
      authorized: false,
      adminUser: dbUser || null,
      userId,
      errorResponse: Response.json(
        { error: "Forbidden: Administrator privileges required." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    adminUser: dbUser,
    userId,
    errorResponse: null,
  };
}
