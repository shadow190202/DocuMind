import { createE2ETestSession, E2E_SESSION_COOKIE_NAME } from "../../../src/lib/auth/e2e-session.js";

/**
 * Injects a signed synthetic E2E authentication cookie into a Playwright BrowserContext.
 *
 * @param {import("@playwright/test").BrowserContext} context
 * @param {{ userId: string, email: string, role?: string }} user
 * @param {string} [baseURL="http://localhost:3001"]
 */
export async function loginAs(context, user, baseURL = "http://localhost:3001") {
  const secret = process.env.DOCUMIND_E2E_SECRET || "documind_e2e_testing_secret_key_32chars";
  const signedCookieValue = await createE2ETestSession(user, secret);

  const url = new URL(baseURL);
  const domain = url.hostname;

  await context.addCookies([
    {
      name: E2E_SESSION_COOKIE_NAME,
      value: signedCookieValue,
      domain,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Clears the synthetic authentication session cookie from a Playwright BrowserContext.
 *
 * @param {import("@playwright/test").BrowserContext} context
 */
export async function logout(context) {
  await context.clearCookies();
}
