import assert from "assert";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  RateLimitError,
  InternalServerError,
  sanitizeLogString,
  handleApiError,
} from "../../../src/lib/errors.js";

export async function run() {
  console.log("\n--- Unit Tests: Centralized Errors & Sanitization ---");
  let passed = 0;

  // 1. Error Hierarchy and Status Codes
  const badReq = new BadRequestError("Invalid input parameters");
  assert.strictEqual(badReq.statusCode, 400);
  assert.strictEqual(badReq.code, "BAD_REQUEST");
  assert.strictEqual(badReq.isOperational, true);

  const unauth = new UnauthorizedError();
  assert.strictEqual(unauth.statusCode, 401);

  const forbidden = new ForbiddenError();
  assert.strictEqual(forbidden.statusCode, 403);

  const notFound = new NotFoundError();
  assert.strictEqual(notFound.statusCode, 404);

  const conflict = new ConflictError();
  assert.strictEqual(conflict.statusCode, 409);

  const tooLarge = new PayloadTooLargeError();
  assert.strictEqual(tooLarge.statusCode, 413);

  const rateLimit = new RateLimitError("Rate limit exceeded", 30);
  assert.strictEqual(rateLimit.statusCode, 429);
  assert.strictEqual(rateLimit.retryAfter, 30);

  const serverErr = new InternalServerError();
  assert.strictEqual(serverErr.statusCode, 500);
  console.log("  ✅ Error hierarchy correctly configures status codes, codes, and operational flags");
  passed++;

  // 2. Sensitive Data Log Sanitization
  const rawLog = "Error connecting to postgresql://admin:secretPass123@localhost:5432/documind with key AIzaSyTestKeyABC1234567890123456 at C:\\Users\\sahus\\DocMind\\src\\index.js";
  const sanitized = sanitizeLogString(rawLog);

  assert(!sanitized.includes("secretPass123"));
  assert(sanitized.includes("[REDACTED_DB_URL]"));
  assert(!sanitized.includes("AIzaSyTestKeyABC1234567890123456"));
  assert(sanitized.includes("[REDACTED_SECRET]"));
  assert(!sanitized.includes("C:\\Users\\sahus"));
  assert(sanitized.includes("[REDACTED_LOCAL_PATH]"));
  console.log("  ✅ sanitizeLogString scrubs DB credentials, API secrets, and filesystem paths");
  passed++;

  // 3. handleApiError Operational Error Handling (< 500)
  const opErr = new BadRequestError("Custom validation failed", { field: "email" });
  const opRes = handleApiError(opErr);
  assert.strictEqual(opRes.status, 400);
  // Read body from Response
  const opBody = await opRes.json();
  assert.strictEqual(opBody.error, "Custom validation failed");
  assert.strictEqual(opBody.code, "BAD_REQUEST");
  assert.deepStrictEqual(opBody.details, { field: "email" });
  console.log("  ✅ handleApiError serializes operational errors cleanly to JSON with matching status code");
  passed++;

  // 4. handleApiError Catastrophic / Internal Error Handling (>= 500)
  const catastrophicErr = new Error("FATAL: database query failed at postgres://user:pass@host/db");
  const catRes = handleApiError(catastrophicErr);
  assert.strictEqual(catRes.status, 500);

  const catBody = await catRes.json();
  assert.strictEqual(catBody.code, "INTERNAL_SERVER_ERROR");
  assert.strictEqual(catBody.error, "An unexpected error occurred. Please try again later.");
  assert(!catBody.error.includes("FATAL"));
  assert(!catBody.error.includes("postgres"));
  assert(catBody.requestId !== undefined);
  assert(typeof catBody.requestId === "string");
  console.log("  ✅ handleApiError masks internal errors, supplies correlation requestId, and prevents data leak");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("errors.test.mjs")) {
  run().then((r) => {
    console.log(`\nError unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Error unit tests failed:", err);
    process.exit(1);
  });
}
