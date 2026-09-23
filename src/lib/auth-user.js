import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Ensures the authenticated Clerk user exists in the local PostgreSQL database.
 * Upserts user profile if missing.
 * @returns {Promise<{ id: string, email: string, name: string, role: string } | null>}
 */
export async function getOrCreateCurrentUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  if (!db) {
    throw new Error("Database connection is not initialized.");
  }

  const email =
    clerkUser.emailAddresses?.[0]?.emailAddress || `${clerkUser.id}@documind.local`;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    "DocuMind User";

  const userRole = clerkUser.publicMetadata?.role === "admin" ? "admin" : "user";

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
