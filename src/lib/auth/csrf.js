import { ForbiddenError } from "../errors.js";

/**
 * Cross-Site Request Forgery (CSRF) & Same-Origin Defense
 *
 * Enforces modern browser security standards:
 * 1. Inspects Sec-Fetch-Site header (rejects 'cross-site' mutative requests).
 * 2. Compares Origin and Referer headers against current host.
 * 3. Safe read methods (GET, HEAD, OPTIONS) are exempt.
 *
 * @param {Request} req - Next.js HTTP Request
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyOrigin(req) {
  const method = req?.method?.toUpperCase() || "GET";

  // Safe idempotent methods are exempt from CSRF checks
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true };
  }

  // 1. Check Sec-Fetch-Site header (set reliably by modern browsers)
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return {
      valid: false,
      reason: "Cross-site request forgery protection: cross-site requests are rejected.",
    };
  }

  // 2. Extract expected host
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) {
    // If no host header is provided at all, allow internal/test invocations
    return { valid: true };
  }

  // 3. Check Origin header
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return {
          valid: false,
          reason: `Cross-site request forgery protection: origin mismatch (${originUrl.host} !== ${host}).`,
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed Origin header." };
    }
  }

  // 4. Check Referer header if Origin is omitted
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return {
          valid: false,
          reason: `Cross-site request forgery protection: referer mismatch (${refererUrl.host} !== ${host}).`,
        };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: "Malformed Referer header." };
    }
  }

  // Same-origin or non-browser client without origin/referer
  return { valid: true };
}

/**
 * Asserts that the request passes same-origin checks, throwing ForbiddenError if invalid.
 *
 * @param {Request} req 
 * @throws {ForbiddenError}
 */
export function assertValidOrigin(req) {
  const verification = verifyOrigin(req);
  if (!verification.valid) {
    throw new ForbiddenError(verification.reason || "Cross-site request rejected.");
  }
}
