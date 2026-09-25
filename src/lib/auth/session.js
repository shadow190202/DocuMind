import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { parseE2ETestSession, E2E_SESSION_COOKIE_NAME } from "./e2e-session.js";

/**
 * Centralized caller authentication resolver for DocuMind.
 *
 * Operational & Security Invariants:
 * 1. Production Mode:
 *    Strictly delegates to authoritative Clerk auth().
 * 2. E2E Test Mode:
 *    If and ONLY if DOCUMIND_E2E_MODE === "enabled" AND DOCUMIND_E2E_SECRET matches,
 *    resolves identity from the HMAC-signed test session cookie (__documind_e2e_session).
 * 3. Cannot be triggered in production (DOCUMIND_E2E_MODE is undefined in production).
 * 4. Eliminates the need to scatter E2E authentication conditionals across application routes.
 *
 * @param {Request|import("next/server").NextRequest|null} [req]
 * @returns {Promise<{
 *   userId: string | null,
 *   sessionId?: string | null,
 *   role?: string,
 *   isE2E: boolean
 * }>}
 */
export async function getAuthSession(req = null) {
  // 1. E2E Synthetic Authentication Path (Strictly Guarded)
  if (
    process.env.DOCUMIND_E2E_MODE === "enabled" &&
    process.env.DOCUMIND_E2E_SECRET &&
    process.env.DOCUMIND_E2E_SECRET.length >= 16
  ) {
    let e2eUser = await parseE2ETestSession(req);
    if (!e2eUser) {
      try {
        const cookieStore = await cookies();
        const cookieVal = cookieStore?.get ? cookieStore.get(E2E_SESSION_COOKIE_NAME)?.value : null;
        if (cookieVal) {
          e2eUser = await parseE2ETestSession(cookieVal);
        }
      } catch {
        // cookies() may throw outside Next request context (e.g. CLI)
      }
    }

    if (e2eUser?.userId) {
      return {
        userId: e2eUser.userId,
        role: e2eUser.role || "user",
        isE2E: true,
      };
    }
  }

  // 2. Authoritative Production Path (Clerk)
  try {
    const clerkAuth = await auth();
    return {
      userId: clerkAuth?.userId || null,
      sessionId: clerkAuth?.sessionId || null,
      isE2E: false,
    };
  } catch {
    return {
      userId: null,
      sessionId: null,
      isE2E: false,
    };
  }
}
