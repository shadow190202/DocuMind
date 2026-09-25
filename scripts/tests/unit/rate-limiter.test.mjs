import assert from "assert";
import {
  checkRateLimit,
  applyRateLimitHeaders,
  resetRateLimits,
  RATE_LIMIT_TIERS,
  getClientIdentifier,
} from "../../../src/lib/rate-limiter.js";

export async function run() {
  console.log("\n--- Unit Tests: In-Memory Sliding-Window Rate Limiter ---");
  let passed = 0;
  resetRateLimits();

  // 1. Client Identifier extraction
  const userIdent = getClientIdentifier(null, "user_123");
  assert.strictEqual(userIdent, "user:user_123");

  const mockIpReq = {
    headers: {
      get: (header) => (header === "x-forwarded-for" ? "203.0.113.195, 10.0.0.1" : null),
    },
  };
  const ipIdent = getClientIdentifier(mockIpReq, null);
  assert.strictEqual(ipIdent, "ip:203.0.113.195");

  const unknownIdent = getClientIdentifier({}, null);
  assert.strictEqual(unknownIdent, "ip:127.0.0.1");
  console.log("  ✅ Client identifier correctly resolves user ID, forwarded IP, or fallback");
  passed++;

  // 2. Sliding window counter decrement and tier bounds
  const testUserId = "test_limiter_user";
  const tier = "ingest"; // limit is 5
  assert.strictEqual(RATE_LIMIT_TIERS.ingest.limit, 5);

  for (let i = 1; i <= 5; i++) {
    const res = checkRateLimit(null, tier, testUserId);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.limit, 5);
    assert.strictEqual(res.remaining, 5 - i);
  }
  console.log("  ✅ Sliding-window counter correctly decrements remaining quota within budget");
  passed++;

  // 3. Exceeding rate limit trips the breaker and sets retryAfter
  const tripResult = checkRateLimit(null, tier, testUserId);
  assert.strictEqual(tripResult.success, false);
  assert.strictEqual(tripResult.remaining, 0);
  assert(tripResult.retryAfter > 0);
  assert.strictEqual(tripResult.limit, 5);
  console.log("  ✅ Exceeding limit triggers rate-limiting response with calculated retryAfter");
  passed++;

  // 4. Rate limit response headers
  const mockHeaders = new Map();
  const mockResponse = {
    headers: {
      set: (k, v) => mockHeaders.set(k, v),
      get: (k) => mockHeaders.get(k),
    },
  };

  applyRateLimitHeaders(mockResponse, tripResult);
  assert.strictEqual(mockHeaders.get("X-RateLimit-Limit"), "5");
  assert.strictEqual(mockHeaders.get("X-RateLimit-Remaining"), "0");
  assert(mockHeaders.get("Retry-After") !== undefined);
  assert(mockHeaders.get("X-RateLimit-Reset") !== undefined);
  console.log("  ✅ applyRateLimitHeaders applies standard RFC rate limit headers");
  passed++;

  // 5. Store reset restores full budget
  resetRateLimits();
  const resetCheck = checkRateLimit(null, tier, testUserId);
  assert.strictEqual(resetCheck.success, true);
  assert.strictEqual(resetCheck.remaining, 4); // 5 - 1 hit
  console.log("  ✅ resetRateLimits immediately restores client quota budget");
  passed++;

  resetRateLimits();
  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("rate-limiter.test.mjs")) {
  run().then((r) => {
    console.log(`\nRate limiter unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Rate limiter unit tests failed:", err);
    process.exit(1);
  });
}
