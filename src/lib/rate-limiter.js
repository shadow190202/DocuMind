/**
 * DocuMind In-Memory Sliding-Window Rate Limiter
 *
 * Operational Characteristics & Explicit Limitations:
 * 1. PER-PROCESS & BEST-EFFORT: This rate limiter executes entirely in-memory within
 *    the current Node.js process runtime.
 * 2. PROCESS LIFETIME: Server restart resets all rate limit counters to zero.
 * 3. NO DISTRIBUTED SYNC: In multi-instance or clustered environments, instances do not
 *    share counters (preserving the strict 100% JavaScript, zero-Redis constraint).
 * 4. APPLICATION-LEVEL THROTTLING ONLY: The 'ai' tier throttles incoming HTTP requests to
 *    reduce burst pressure on the Google Gemini free tier. It DOES NOT provide a mathematical
 *    guarantee against upstream provider quotas, because a single HTTP turn (e.g. recursive
 *    summarization or comparison) may perform multiple Gemini API calls and retry attempts.
 * 5. DISCLAIMER: DocuMind-observed usage only. Google Gemini provider quota limits are
 *    managed independently in Google Cloud Console.
 */

// Global in-memory storage for sliding windows: tier -> key -> Array<timestamp>
const rateLimitStores = new Map();

export const RATE_LIMIT_TIERS = {
  ai: {
    limit: 10,
    windowMs: 60 * 1000, // 10 requests per 60 seconds
    description: "Application-level throttling for AI operations (Chat, Summarize, Compare)",
  },
  ingest: {
    limit: 5,
    windowMs: 60 * 1000, // 5 requests per 60 seconds
    description: "Document upload and heavy chunking/embedding ingestion",
  },
  mutation: {
    limit: 20,
    windowMs: 60 * 1000, // 20 requests per 60 seconds
    description: "Document sharing, role updates, and metadata mutations",
  },
  general: {
    limit: 60,
    windowMs: 60 * 1000, // 60 requests per 60 seconds
    description: "General read queries, search, and listings",
  },
};

/**
 * Extracts client identifier from request or user context.
 *
 * @param {Request} req 
 * @param {string|null} [explicitUserId] 
 * @returns {string}
 */
export function getClientIdentifier(req, explicitUserId = null) {
  if (explicitUserId && typeof explicitUserId === "string" && explicitUserId.trim().length > 0) {
    return `user:${explicitUserId.trim()}`;
  }

  // Fallback to IP address headers
  const xForwardedFor = req?.headers?.get?.("x-forwarded-for");
  if (xForwardedFor) {
    const clientIp = xForwardedFor.split(",")[0].trim();
    if (clientIp) return `ip:${clientIp}`;
  }

  const realIp = req?.headers?.get?.("x-real-ip") || req?.headers?.get?.("cf-connecting-ip");
  if (realIp) return `ip:${realIp.trim()}`;

  return "ip:127.0.0.1";
}

/**
 * Checks and records a rate limit hit using sliding-window counter.
 *
 * @param {Request} req - Next.js Request
 * @param {'ai'|'ingest'|'mutation'|'general'} [tier='general'] - Rate limit tier
 * @param {string|null} [explicitUserId=null] - Authenticated user ID if known
 * @returns {{
 *   success: boolean,
 *   limit: number,
 *   remaining: number,
 *   reset: number,
 *   retryAfter?: number,
 *   tier: string
 * }}
 */
export function checkRateLimit(req, tier = "general", explicitUserId = null) {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.general;
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const identifier = getClientIdentifier(req, explicitUserId);
  const storeKey = `${tier}:${identifier}`;

  if (!rateLimitStores.has(storeKey)) {
    rateLimitStores.set(storeKey, []);
  }

  const timestamps = rateLimitStores.get(storeKey);

  // Filter timestamps within current sliding window
  const recentTimestamps = timestamps.filter((ts) => ts > windowStart);

  const resetEpochSeconds = Math.ceil((now + config.windowMs) / 1000);

  if (recentTimestamps.length >= config.limit) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + config.windowMs - now) / 1000));

    // Update store with pruned entries
    rateLimitStores.set(storeKey, recentTimestamps);

    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      reset: resetEpochSeconds,
      retryAfter: retryAfterSeconds,
      tier,
    };
  }

  // Record current hit
  recentTimestamps.push(now);
  rateLimitStores.set(storeKey, recentTimestamps);

  return {
    success: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - recentTimestamps.length),
    reset: resetEpochSeconds,
    tier,
  };
}

/**
 * Applies RFC-compliant rate limit headers to a NextResponse.
 *
 * @param {import("next/server").NextResponse} response 
 * @param {Object} rateLimitResult 
 * @returns {import("next/server").NextResponse}
 */
export function applyRateLimitHeaders(response, rateLimitResult) {
  if (!response || !rateLimitResult) return response;

  response.headers.set("X-RateLimit-Limit", String(rateLimitResult.limit));
  response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
  response.headers.set("X-RateLimit-Reset", String(rateLimitResult.reset));

  if (!rateLimitResult.success && rateLimitResult.retryAfter) {
    response.headers.set("Retry-After", String(rateLimitResult.retryAfter));
  }

  return response;
}

/**
 * Resets all rate limit stores. Useful for automated test teardowns.
 */
export function resetRateLimits() {
  rateLimitStores.clear();
}

// Background auto-purge of stale stores every 60 seconds
if (typeof setInterval !== "undefined") {
  const purgeInterval = setInterval(() => {
    const now = Date.now();
    for (const [storeKey, timestamps] of rateLimitStores.entries()) {
      // Find tier to know window
      const tierName = storeKey.split(":")[0];
      const tierConfig = RATE_LIMIT_TIERS[tierName] || RATE_LIMIT_TIERS.general;
      const windowStart = now - tierConfig.windowMs;

      const validTimestamps = timestamps.filter((ts) => ts > windowStart);
      if (validTimestamps.length === 0) {
        rateLimitStores.delete(storeKey);
      } else {
        rateLimitStores.set(storeKey, validTimestamps);
      }
    }
  }, 60 * 1000);

  // Unref the timer so it doesn't keep the Node.js event loop alive in CLI/test scripts
  if (purgeInterval && typeof purgeInterval.unref === "function") {
    purgeInterval.unref();
  }
}
