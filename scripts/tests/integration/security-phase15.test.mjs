import assert from "assert";
import crypto from "crypto";
import {
  MAX_FILE_SIZE,
  fileUploadSchema,
  validateDocumentBuffer,
} from "../../../src/lib/validations/document.js";
import { safeResolvePath, STORAGE_ROOT } from "../../../src/lib/storage.js";
import { checkRateLimit, resetRateLimits } from "../../../src/lib/rate-limiter.js";
import { sanitizeLogString, handleApiError } from "../../../src/lib/errors.js";

export async function run() {
  console.log("\n--- Integration Tests: Phase 15 Security Hardening Invariants ---");
  let passed = 0;
  resetRateLimits();

  // 1. Invariant: 20 MB File Size Boundary
  assert.strictEqual(MAX_FILE_SIZE, 20971520, "MAX_FILE_SIZE must strictly remain 20 MB");
  assert.strictEqual(fileUploadSchema.safeParse({ filename: "doc.pdf", size: 20971520 }).success, true);
  assert.strictEqual(fileUploadSchema.safeParse({ filename: "doc.pdf", size: 20971521 }).success, false);
  console.log("  ✅ Invariant 1: 20 MB maximum upload limit is strictly preserved");
  passed++;

  // 2. Invariant: Magic-Byte & Disguised Executable Defense
  const validPdfHeader = Buffer.from("%PDF-1.4\nTest PDF content", "utf8");
  assert.strictEqual(validateDocumentBuffer(validPdfHeader, "pdf").valid, true);

  const peBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ Windows executable
  assert.strictEqual(validateDocumentBuffer(peBinary, "pdf").valid, false);
  assert.strictEqual(validateDocumentBuffer(peBinary, "docx").valid, false);

  const elfBinary = Buffer.from([0x7f, 0x45, 0x4c, 0x46]); // ELF Linux binary
  assert.strictEqual(validateDocumentBuffer(elfBinary, "txt").valid, false);
  console.log("  ✅ Invariant 2: Magic-byte inspection detects and rejects disguised binaries");
  passed++;

  // 3. Invariant: Single-Column CSV and Delimiter Flexibility
  const singleColCsv = Buffer.from("single_column_header\nvalue_row_1\nvalue_row_2", "utf8");
  assert.strictEqual(validateDocumentBuffer(singleColCsv, "csv").valid, true);

  const nullByteCsv = Buffer.from("header\nval\0ue", "utf8");
  assert.strictEqual(validateDocumentBuffer(nullByteCsv, "csv").valid, false);
  console.log("  ✅ Invariant 3: Single-column CSV is supported without delimiter enforcement while blocking null bytes");
  passed++;

  // 4. Invariant: Storage Traversal and Null-Byte Injections
  const badPaths = [
    "../../etc/shadow",
    "..\\..\\windows\\system.ini",
    "%2e%2e%2froot.key",
    "safe.txt\0.exe",
    "safe.txt%00.exe",
  ];
  for (const bp of badPaths) {
    let thrown = false;
    try {
      safeResolvePath(STORAGE_ROOT, bp);
    } catch {
      thrown = true;
    }
    assert.strictEqual(thrown, true, `Path '${bp}' must trigger security violation`);
  }
  console.log("  ✅ Invariant 4: safeResolvePath rejects directory traversal, percent-encoding, and null bytes");
  passed++;

  // 5. Invariant: Application-Level Rate Limiting
  const testClient = "sec_test_client_01";
  for (let i = 0; i < 10; i++) {
    assert.strictEqual(checkRateLimit(null, "ai", testClient).success, true);
  }
  const blocked = checkRateLimit(null, "ai", testClient);
  assert.strictEqual(blocked.success, false);
  assert.strictEqual(blocked.remaining, 0);
  assert(blocked.retryAfter > 0);
  console.log("  ✅ Invariant 5: Rate limiter blocks burst requests exceeding 10 req/min for AI tier");
  passed++;

  // 6. Invariant: Production Error Sanitization & Correlation ID
  const internalErr = new Error("Database query failed: select * from users where pass='secretPass'");
  const errorResponse = handleApiError(internalErr);
  assert.strictEqual(errorResponse.status, 500);

  const errorBody = await errorResponse.json();
  assert.strictEqual(errorBody.code, "INTERNAL_SERVER_ERROR");
  assert.strictEqual(errorBody.error, "An unexpected error occurred. Please try again later.");
  assert(!JSON.stringify(errorBody).includes("secretPass"));
  assert(errorBody.requestId !== undefined);
  assert(typeof errorBody.requestId === "string");
  console.log("  ✅ Invariant 6: 500 errors scrub sensitive tokens, provide generic message and correlation ID");
  passed++;

  resetRateLimits();
  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("security-phase15.test.mjs")) {
  run().then((r) => {
    console.log(`\nPhase 15 Security integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Phase 15 Security integration tests failed:", err);
    process.exit(1);
  });
}
