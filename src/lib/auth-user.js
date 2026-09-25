import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

import { getAuthSession } from "./auth/session.js";

/**
 * Ensures the authenticated Clerk or E2E user exists in the local PostgreSQL database.
 * Upserts user profile if missing.
 * @param {Request|null} [req]
 * @returns {Promise<{ id: string, email: string, name: string, role: string } | null>}
 */
export async function getOrCreateCurrentUser(req = null) {
  let clerkUser = null;
  try {
    clerkUser = await currentUser();
  } catch {
    clerkUser = null;
  }

  let id = null;
  let email = null;
  let name = null;
  let userRole = "user";

  if (clerkUser) {
    id = clerkUser.id;
    email = clerkUser.emailAddresses?.[0]?.emailAddress || `${clerkUser.id}@documind.local`;
    name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "DocuMind User";
    userRole = clerkUser.publicMetadata?.role === "admin" ? "admin" : "user";
  } else if (
    process.env.DOCUMIND_E2E_MODE === "enabled" &&
    process.env.DOCUMIND_E2E_SECRET
  ) {
    const session = await getAuthSession(req);
    if (!session?.userId) return null;
    id = session.userId;
    email = `${session.userId}@documind.test`;
    name = `E2E Test User ${session.userId}`;
    userRole = session.role || "user";
  } else {
    return null;
  }

  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, clerkUser.id));

    if (existing.length === 0) {
      await db.insert(users).values({
        id: clerkUser.id,
        email,
        name,
        role: userRole,
      });
    }
  } catch (error) {
    console.error("Error synchronizing user with database:", error);
  }

  return {
    id: clerkUser.id,
    email,
    name,
    role: userRole,
  };
}
