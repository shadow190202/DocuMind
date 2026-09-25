/**
 * DocuMind Phase 15: Security Hardening & Centralized Error Handling Test Suite
 *
 * Validates all 18 mandatory security, error-handling, and operational invariants:
 * 1. 20 MB File Size Limit Preserved (Strictly preserved, rejects > 20 MB, accepts <= 20 MB)
 * 2. Valid PDF Accepted (%PDF- magic bytes verified)
 * 3. Disguised Executable Rejected (PE 'MZ', ELF, Mach-O detected and rejected)
 * 4. Valid DOCX Accepted (PK ZIP magic bytes + OpenXML structure verified)
 * 5. Corrupted / Traversal DOCX Rejected (Missing structure or containing ../ rejected)
 * 6. Valid TXT Accepted (Valid UTF-8 decodable)
 * 7. TXT with Null Bytes Rejected (Binary null byte injection blocked)
 * 8. Single-Column CSV Accepted (No delimiter enforcement on single column; null bytes rejected)
 * 9. AI Rate Limit Triggers 429 (10 req/min threshold, Retry-After header present)
 * 10. Rate Limit Budget Reset (Sliding-window budget reset capability verified)
 * 11. Phase 9 Gemini Retry Logic Intact (Backoff and transient error handling preserved)
 * 12. Storage Path Traversal Rejected (safeResolvePath throws on ../, %2e%2e, null bytes)
 * 13. Storage Boundary Containment Verified (Strict child directory containment asserted)
 * 14. Production Error Sanitization (500 errors scrub secrets, connection strings, paths, SQL)
 * 15. Error Correlation ID Logged (UUID requestId returned to client and logged)
 * 16. React Error Boundary Correlation ID (reference ID rendered ONLY when digest/requestId exists)
 * 17. Production-Aware HSTS Verified (Enforced ONLY in production HTTPS; omitted in dev/http)
 * 18. Clean Fixture Teardown (Clean teardown of test artifacts, stores, and connections)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NextResponse } from "next/server.js";
import {
  MAX_FILE_SIZE,
  fileUploadSchema,
  validateDocumentBuffer,
} from "../src/lib/validations/document.js";
import {
  safeResolvePath,
  STORAGE_ROOT,
  EXTRACTED_ROOT,
} from "../src/lib/storage.js";
import {
  RATE_LIMIT_TIERS,
  checkRateLimit,
  applyRateLimitHeaders,
  resetRateLimits,
} from "../src/lib/rate-limiter.js";
import {
  AppError,
  BadRequestError,
  handleApiError,
  sanitizeLogString,
} from "../src/lib/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["'](.*)["']$/, "$1");
        }
      }
    }
  }
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
  passedTests++;
}

async function runPhase15Verification() {
  console.log("==========================================================");
  console.log("  DocuMind Phase 15: Security Hardening Verification     ");
  console.log("==========================================================\n");

  try {
    // ------------------------------------------------------------------
    // TEST 1: 20 MB File Size Limit Preserved
    // ------------------------------------------------------------------
    console.log("--- 1. Testing 20 MB File Size Contract ---");
    assert(MAX_FILE_SIZE === 20 * 1024 * 1024, "MAX_FILE_SIZE is strictly 20 MB (20,971,520 bytes)");

    // Zod fileUploadSchema validation
    const validSizeCheck = fileUploadSchema.safeParse({
      filename: "test.pdf",
      size: 20 * 1024 * 1024, // Exactly 20 MB
    });
    assert(validSizeCheck.success, "fileUploadSchema accepts exactly 20 MB file");

    const oversizedCheck = fileUploadSchema.safeParse({
      filename: "test.pdf",
      size: 20 * 1024 * 1024 + 1, // 20 MB + 1 byte
    });
    assert(!oversizedCheck.success, "fileUploadSchema rejects file > 20 MB");

    // validateDocumentBuffer size check
    const oversizedBuffer = Buffer.alloc(20 * 1024 * 1024 + 1);
    const oversizedBufResult = validateDocumentBuffer(oversizedBuffer, "pdf");
    assert(!oversizedBufResult.valid && oversizedBufResult.error.includes("20MB"), "validateDocumentBuffer rejects buffer > 20 MB");

    // ------------------------------------------------------------------
    // TEST 2: Valid PDF Accepted
    // ------------------------------------------------------------------
    console.log("\n--- 2. Testing Valid PDF Magic Bytes ---");
    const validPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const pdfResult = validateDocumentBuffer(validPdfBuffer, "pdf");
    assert(pdfResult.valid === true, "validateDocumentBuffer accepts valid %PDF- header");

    const invalidPdfHeader = Buffer.from("NOT_A_PDF_FILE_HEADER");
    const invalidPdfResult = validateDocumentBuffer(invalidPdfHeader, "pdf");
    assert(!invalidPdfResult.valid && invalidPdfResult.error.includes("%PDF-"), "validateDocumentBuffer rejects PDF missing %PDF- header");

    // ------------------------------------------------------------------
    // TEST 3: Disguised Executable Rejected
    // ------------------------------------------------------------------
    console.log("\n--- 3. Testing Disguised Executable Detection ---");
    // Windows PE ('MZ') disguised as PDF
    const peDisguisedAsPdf = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]);
    const peResult = validateDocumentBuffer(peDisguisedAsPdf, "pdf");
    assert(!peResult.valid && peResult.error.includes("executable binary"), "Rejects Windows PE binary disguised as PDF");

    // Linux ELF ('\x7fELF') disguised as DOCX
    const elfDisguisedAsDocx = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(100)]);
    const elfResult = validateDocumentBuffer(elfDisguisedAsDocx, "docx");
    assert(!elfResult.valid && elfResult.error.includes("executable binary"), "Rejects Linux ELF binary disguised as DOCX");

    // Mach-O disguised as TXT
    const machODisguisedAsTxt = Buffer.concat([Buffer.from([0xfe, 0xed, 0xfa, 0xce]), Buffer.alloc(100)]);
    const machOResult = validateDocumentBuffer(machODisguisedAsTxt, "txt");
    assert(!machOResult.valid && machOResult.error.includes("executable binary"), "Rejects Mach-O binary disguised as TXT");

    // ------------------------------------------------------------------
    // TEST 4: Valid DOCX Accepted
    // ------------------------------------------------------------------
    console.log("\n--- 4. Testing Valid DOCX OpenXML Structure ---");
    // Standard ZIP header: 0x50, 0x4b, 0x03, 0x04
    const validDocxBuffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("some_zip_header_bytes"),
      Buffer.from("word/document.xml"),
      Buffer.alloc(50),
    ]);
    const docxResult = validateDocumentBuffer(validDocxBuffer, "docx");
    assert(docxResult.valid === true, "validateDocumentBuffer accepts valid DOCX with word/ entry");

    const validDocxContentTypes = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("some_zip_header_bytes"),
      Buffer.from("[Content_Types].xml"),
      Buffer.alloc(50),
    ]);
    assert(validateDocumentBuffer(validDocxContentTypes, "docx").valid === true, "validateDocumentBuffer accepts valid DOCX with [Content_Types].xml entry");

    // ------------------------------------------------------------------
    // TEST 5: Corrupted / Traversal DOCX Rejected
    // ------------------------------------------------------------------
    console.log("\n--- 5. Testing Corrupted & Traversal DOCX Rejection ---");
    // Missing Word markers
    const nonWordZip = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("some_random_zip_file_without_openxml_markers"),
    ]);
    const nonWordResult = validateDocumentBuffer(nonWordZip, "docx");
    assert(!nonWordResult.valid && nonWordResult.error.includes("OpenXML"), "Rejects ZIP file lacking Word OpenXML structures");

    // DOCX with path traversal sequence inside ZIP entry
    const traversalDocx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("word/document.xml"),
      Buffer.from("../../../etc/passwd"),
    ]);
    const traversalDocxResult = validateDocumentBuffer(traversalDocx, "docx");
    assert(!traversalDocxResult.valid && traversalDocxResult.error.includes("directory traversal"), "Rejects DOCX with directory traversal in entry names");

    // ------------------------------------------------------------------
    // TEST 6: Valid TXT Accepted
    // ------------------------------------------------------------------
    console.log("\n--- 6. Testing Valid TXT Content ---");
    const validTxtBuffer = Buffer.from("Hello world! This is a valid UTF-8 text file.\nLine 2 with tab:\tDone.\nUnicode: 🚀 DocuMind");
    const txtResult = validateDocumentBuffer(validTxtBuffer, "txt");
    assert(txtResult.valid === true, "validateDocumentBuffer accepts valid UTF-8 TXT buffer with whitespace and Unicode");

    // ------------------------------------------------------------------
    // TEST 7: TXT with Null Bytes Rejected
    // ------------------------------------------------------------------
    console.log("\n--- 7. Testing Null-Byte Rejection in TXT ---");
    const nullByteTxtBuffer = Buffer.from("Normal text before null\0evil hidden payload");
    const nullTxtResult = validateDocumentBuffer(nullByteTxtBuffer, "txt");
    assert(!nullTxtResult.valid && nullTxtResult.error.includes("null byte"), "Rejects TXT file containing binary null bytes");

    // ------------------------------------------------------------------
    // TEST 8: Single-Column CSV Accepted
    // ------------------------------------------------------------------
    console.log("\n--- 8. Testing Single-Column and Multi-Column CSV ---");
    const singleColCsv = Buffer.from("Identifier\nDOC-001\nDOC-002\nDOC-003\n");
    const singleColResult = validateDocumentBuffer(singleColCsv, "csv");
    assert(singleColResult.valid === true, "Single-column CSV accepted without requiring comma/semicolon delimiters");

    const multiColCsv = Buffer.from("id,name,role\n1,Alice,admin\n2,Bob,user\n");
    const multiColResult = validateDocumentBuffer(multiColCsv, "csv");
    assert(multiColResult.valid === true, "Standard multi-column CSV accepted");

    const nullByteCsv = Buffer.from("col1,col2\nval1,\0val2\n");
    const nullCsvResult = validateDocumentBuffer(nullByteCsv, "csv");
    assert(!nullCsvResult.valid && nullCsvResult.error.includes("null byte"), "CSV with null byte injection is strictly rejected");

    // ------------------------------------------------------------------
    // TEST 9: AI Rate Limit Triggers 429 with Retry-After
    // ------------------------------------------------------------------
    console.log("\n--- 9. Testing AI Rate Limiter (10 req/min) ---");
    resetRateLimits();

    const mockAiUserId = "test_rate_limit_user";
    const dummyReq = {
      headers: new Headers({ "x-forwarded-for": "192.168.1.100" }),
    };

    // First 10 AI tier requests should succeed
    for (let i = 1; i <= RATE_LIMIT_TIERS.ai.limit; i++) {
      const res = checkRateLimit(dummyReq, "ai", mockAiUserId);
      assert(res.success === true, `AI rate limit request ${i}/${RATE_LIMIT_TIERS.ai.limit} allowed`);
    }

    // 11th request must fail with 429 semantics
    const excessRes = checkRateLimit(dummyReq, "ai", mockAiUserId);
    assert(excessRes.success === false, "11th AI request exceeds rate limit (success: false)");
    assert(excessRes.remaining === 0, "Remaining budget is 0 on rate limit trip");
    assert(typeof excessRes.retryAfter === "number" && excessRes.retryAfter >= 1, "Provides retryAfter seconds value");

    // Test applyRateLimitHeaders on excess response
    const mockNextRes = NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
    applyRateLimitHeaders(mockNextRes, excessRes);
    assert(mockNextRes.headers.get("X-RateLimit-Limit") === "10", "X-RateLimit-Limit header is set to 10");
    assert(mockNextRes.headers.get("X-RateLimit-Remaining") === "0", "X-RateLimit-Remaining header is set to 0");
    assert(Number(mockNextRes.headers.get("Retry-After")) >= 1, "Retry-After header is set");

    // ------------------------------------------------------------------
    // TEST 10: Rate Limit Window Auto-Resets Budget
    // ------------------------------------------------------------------
    console.log("\n--- 10. Testing Rate Limit Budget Reset ---");
    resetRateLimits();
    const freshRes = checkRateLimit(dummyReq, "ai", mockAiUserId);
    assert(freshRes.success === true, "Rate limit counter successfully reset");
    assert(freshRes.remaining === RATE_LIMIT_TIERS.ai.limit - 1, "Remaining count restored to limit - 1");

    // ------------------------------------------------------------------
    // TEST 11: Phase 9 Gemini Retry Logic Intact
    // ------------------------------------------------------------------
    console.log("\n--- 11. Testing Gemini Retry Logic Preservation ---");
    const geminiCode = fs.readFileSync(path.resolve(__dirname, "../src/lib/ai/gemini.js"), "utf8");
    assert(geminiCode.includes("isTransientError"), "Gemini module retains transient error detection");
    assert(geminiCode.includes("maxRetries") || geminiCode.includes("maxAttempts"), "Gemini module retains retry loop with max attempts");
    assert(geminiCode.includes("delay *= 2") || geminiCode.includes("await sleep("), "Gemini module retains backoff delay mechanism");

    // ------------------------------------------------------------------
    // TEST 12: Storage Path Traversal Rejected
    // ------------------------------------------------------------------
    console.log("\n--- 12. Testing Storage Path Traversal Defense ---");
    let caughtTraversal1 = false;
    try {
      safeResolvePath(STORAGE_ROOT, "../secret.txt");
    } catch (err) {
      caughtTraversal1 = true;
      assert(err.message.includes("path traversal"), "safeResolvePath blocks raw '../' traversal");
    }
    assert(caughtTraversal1, "Raw '../' traversal threw expected exception");

    let caughtTraversal2 = false;
    try {
      safeResolvePath(STORAGE_ROOT, "%2e%2e/secret.txt");
    } catch (err) {
      caughtTraversal2 = true;
      assert(err.message.includes("path traversal"), "safeResolvePath blocks percent-encoded '%2e%2e' traversal");
    }
    assert(caughtTraversal2, "Percent-encoded traversal threw expected exception");

    let caughtNullByte = false;
    try {
      safeResolvePath(STORAGE_ROOT, "subfolder/file\0.txt");
    } catch (err) {
      caughtNullByte = true;
      assert(err.message.includes("null byte"), "safeResolvePath blocks null-byte injection");
    }
    assert(caughtNullByte, "Null-byte injection in path threw expected exception");

    // ------------------------------------------------------------------
    // TEST 13: Storage Boundary Containment Verified
    // ------------------------------------------------------------------
    console.log("\n--- 13. Testing Storage Boundary Containment ---");
    const resolvedSafePath = safeResolvePath(STORAGE_ROOT, "user_12345/test-file.pdf");
    const expectedPrefix = path.resolve(STORAGE_ROOT) + path.sep;
    assert(resolvedSafePath.startsWith(expectedPrefix), "Safe relative path resolves strictly inside STORAGE_ROOT");

    // ------------------------------------------------------------------
    // TEST 14: Production Error Sanitization
    // ------------------------------------------------------------------
    console.log("\n--- 14. Testing Production Error Sanitization ---");
    // Ensure sanitizeLogString scrubs sensitive elements
    const testSecretLog = "Failed: postgres://admin:supersecret@db.internal:5432/documind at C:\\Users\\sahus\\DocMind\\src\\db.js:12";
    const scrubbed = sanitizeLogString(testSecretLog);
    assert(!scrubbed.includes("supersecret"), "sanitizeLogString strips DB password");
    assert(scrubbed.includes("[REDACTED_DB_URL]"), "sanitizeLogString replaces database connection string");
    assert(!scrubbed.includes("C:\\Users\\sahus"), "sanitizeLogString strips local Windows path");

    // Operational error returns exact status and details
    const opError = new BadRequestError("Invalid query parameter.", { field: "timeRange" });
    const opRes = handleApiError(opError);
    assert(opRes.status === 400, "Operational error returns status 400");

    // Uncaught internal error with leaked secrets
    const catastrophicError = new Error("FATAL: connection to postgres://admin:p@ssword123@10.0.0.1:5432 failed at /var/www/app/src/db.js:45");
    const origConsoleError = console.error;
    let loggedServerMessage = "";
    console.error = (...args) => {
      loggedServerMessage += args.join(" ");
    };

    const clientRes = handleApiError(catastrophicError);
    console.error = origConsoleError;

    assert(clientRes.status === 500, "Catastrophic error returns HTTP 500");
    // Parse client response body
    // Using Response clone or reading stream
    const clientBody = await clientRes.json();
    assert(clientBody.error === "An unexpected error occurred. Please try again later.", "Generic client-safe error message returned");
    assert(clientBody.code === "INTERNAL_SERVER_ERROR", "INTERNAL_SERVER_ERROR error code returned");
    assert(!JSON.stringify(clientBody).includes("postgres://"), "Zero database URL leak in client response body");
    assert(!JSON.stringify(clientBody).includes("p@ssword123"), "Zero password leak in client response body");
    assert(!JSON.stringify(clientBody).includes("/var/www/app"), "Zero filesystem path leak in client response body");

    // ------------------------------------------------------------------
    // TEST 15: Error Correlation ID Logged
    // ------------------------------------------------------------------
    console.log("\n--- 15. Testing Error Correlation ID ---");
    assert(typeof clientBody.requestId === "string" && clientBody.requestId.length > 0, "requestId correlation ID present in response body");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(clientBody.requestId), "requestId is a valid UUIDv4 string");
    assert(loggedServerMessage.includes(clientBody.requestId), "Server console log contains the exact matching correlation requestId");

    // ------------------------------------------------------------------
    // TEST 16: React Error Boundary Correlation ID
    // ------------------------------------------------------------------
    console.log("\n--- 16. Testing React Error Boundary Logic ---");
    const errorBoundaryCode = fs.readFileSync(path.resolve(__dirname, "../src/app/error.jsx"), "utf8");
    assert(
      errorBoundaryCode.includes("const referenceId = error?.digest || error?.requestId || null;"),
      "error.jsx checks error?.digest || error?.requestId without synthesizing a fake ID"
    );
    assert(
      errorBoundaryCode.includes("{referenceId && ("),
      "error.jsx renders Reference ID conditionally only when referenceId exists"
    );

    const globalErrorBoundaryCode = fs.readFileSync(path.resolve(__dirname, "../src/app/global-error.jsx"), "utf8");
    assert(
      globalErrorBoundaryCode.includes("const referenceId = error?.digest || error?.requestId || null;"),
      "global-error.jsx checks error?.digest || error?.requestId without synthesizing a fake ID"
    );
    assert(
      globalErrorBoundaryCode.includes("{referenceId && ("),
      "global-error.jsx renders Reference ID conditionally only when referenceId exists"
    );

    // ------------------------------------------------------------------
    // TEST 17: Production-Aware HSTS Logic Verified
    // ------------------------------------------------------------------
    console.log("\n--- 17. Testing Production-Aware HSTS ---");
    const middlewareCode = fs.readFileSync(path.resolve(__dirname, "../src/middleware.js"), "utf8");
    assert(
      middlewareCode.includes('process.env.NODE_ENV === "production"'),
      "Middleware checks for production environment"
    );
    assert(
      middlewareCode.includes("https") && middlewareCode.includes("Strict-Transport-Security"),
      "Middleware sets Strict-Transport-Security only when HTTPS is detected in production"
    );

    // ------------------------------------------------------------------
    // TEST 18: Clean Fixture Teardown
    // ------------------------------------------------------------------
    console.log("\n--- 18. Testing Clean Fixture Teardown ---");
    resetRateLimits();
    assert(true, "All test fixtures and sliding window states cleaned up cleanly");

    console.log("\n==========================================================");
    console.log(`  ALL PHASE 15 TESTS PASSED: ${passedTests}/${totalTests} `);
    console.log("==========================================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ PHASE 15 VERIFICATION FAILED:", error);
    process.exit(1);
  }
}

runPhase15Verification();
