export const E2E_SESSION_COOKIE_NAME = "__documind_e2e_session";

/**
 * Universal base64 encoder
 */
function toBase64(str) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Universal base64 decoder
 */
function fromBase64(b64) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

/**
 * Constant-time comparison for hex signatures across all runtimes
 */
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Universal HMAC-SHA256 calculation using Web Crypto API (supported in Edge, Node 18+, and browsers)
 */
async function computeHmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a signed E2E test session payload.
 * Strictly available during automated test runs.
 *
 * @param {{ userId: string, email: string, role?: string }} user
 * @param {string} secret
 * @returns {Promise<string>} - Signed cookie value: base64(payload).signature
 */
export async function createE2ETestSession(user, secret = process.env.DOCUMIND_E2E_SECRET) {
  if (!secret || secret.length < 16) {
    throw new Error("DOCUMIND_E2E_SECRET must be configured with at least 16 characters for test runs.");
  }

  const payload = {
    userId: user.userId,
    email: user.email,
    role: user.role || "user",
    ts: Date.now(),
  };

  const encodedPayload = toBase64(JSON.stringify(payload));
  const signature = await computeHmacSha256(secret, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

/**
 * Parses and cryptographically verifies an incoming E2E test session.
 *
 * Security Invariants:
 * 1. Strictly disabled if DOCUMIND_E2E_MODE !== "enabled".
 * 2. Strictly disabled if DOCUMIND_E2E_SECRET is absent or shorter than 16 chars.
 * 3. Enforces constant-time HMAC signature verification.
 * 4. Rejects expired sessions (> 4 hours).
 *
 * @param {Request|import("next/server").NextRequest|string|null} [req]
 * @returns {Promise<{ userId: string, email: string, role: string } | null>}
 */
export async function parseE2ETestSession(req = null) {
  if (process.env.DOCUMIND_E2E_MODE !== "enabled") {
    return null;
  }

  const secret = process.env.DOCUMIND_E2E_SECRET;
  if (!secret || typeof secret !== "string" || secret.length < 16) {
    return null;
  }

  let cookieValue = null;

  if (typeof req === "string") {
    cookieValue = req;
  } else if (req?.cookies?.get) {
    cookieValue = req.cookies.get(E2E_SESSION_COOKIE_NAME)?.value;
  } else if (typeof req?.headers?.get === "function") {
    const rawCookies = req.headers.get("cookie") || "";
    const match = rawCookies.match(new RegExp(`(?:^|;\\s*)${E2E_SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      cookieValue = decodeURIComponent(match[1]);
    } else {
      cookieValue = req.headers.get("x-e2e-session");
    }
  } else if (req?.headers && typeof req.headers === "object") {
    const rawCookies = req.headers.cookie || "";
    const match = rawCookies.match(new RegExp(`(?:^|;\\s*)${E2E_SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      cookieValue = decodeURIComponent(match[1]);
    } else {
      cookieValue = req.headers["x-e2e-session"];
    }
  }

  if (!cookieValue || !cookieValue.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const expectedSignature = await computeHmacSha256(secret, encodedPayload);

    if (!timingSafeEqualHex(signature, expectedSignature)) {
      return null;
    }

    const payload = JSON.parse(fromBase64(encodedPayload));
    if (!payload?.userId || typeof payload.userId !== "string") {
      return null;
    }

    // Reject sessions older than 4 hours
    if (typeof payload.ts === "number" && Date.now() - payload.ts > 4 * 60 * 60 * 1000) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email || `${payload.userId}@documind.test`,
      role: payload.role || "user",
    };
  } catch {
    return null;
  }
}
