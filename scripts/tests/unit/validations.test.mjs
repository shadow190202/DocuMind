import assert from "assert";
import crypto from "crypto";
import {
  fileUploadSchema,
  MAX_FILE_SIZE,
  validateDocumentBuffer,
} from "../../../src/lib/validations/document.js";
import { chatRequestSchema } from "../../../src/lib/validations/chat.js";
import {
  shareDocumentSchema,
  updatePermissionSchema,
} from "../../../src/lib/validations/permission.js";
import { compareDocumentsRequestSchema } from "../../../src/lib/validations/comparison.js";
import {
  adminUsersQuerySchema,
  updateUserRoleSchema,
} from "../../../src/lib/validations/admin.js";
import { summarizeRequestSchema } from "../../../src/lib/validations/summary.js";

export async function run() {
  console.log("\n--- Unit Tests: Input Validation & Zod Schemas ---");
  let passed = 0;

  // 1. File Upload Schema: 20 MB size limit and extensions
  assert.strictEqual(MAX_FILE_SIZE, 20 * 1024 * 1024);
  const validUpload = fileUploadSchema.safeParse({
    filename: "report.pdf",
    size: 20 * 1024 * 1024,
  });
  assert.strictEqual(validUpload.success, true);

  const oversizedUpload = fileUploadSchema.safeParse({
    filename: "report.pdf",
    size: 20 * 1024 * 1024 + 1,
  });
  assert.strictEqual(oversizedUpload.success, false);

  const invalidExtUpload = fileUploadSchema.safeParse({
    filename: "script.sh",
    size: 1024,
  });
  assert.strictEqual(invalidExtUpload.success, false);
  console.log("  ✅ File upload schema enforces 20MB limit and allowed extensions");
  passed++;

  // 2. Buffer Inspection: PDF magic bytes vs Executables
  const validPdfBuf = Buffer.from("%PDF-1.7\nSample content", "utf8");
  assert.strictEqual(validateDocumentBuffer(validPdfBuf, "pdf").valid, true);

  const fakePdfBuf = Buffer.from("NOT_A_PDF_STREAM", "utf8");
  assert.strictEqual(validateDocumentBuffer(fakePdfBuf, "pdf").valid, false);

  const peBinary = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ Windows executable header
  assert.strictEqual(validateDocumentBuffer(peBinary, "pdf").valid, false);
  assert.strictEqual(validateDocumentBuffer(peBinary, "docx").valid, false);
  assert.strictEqual(validateDocumentBuffer(peBinary, "txt").valid, false);
  console.log("  ✅ Buffer inspection verifies magic bytes and detects disguised executables");
  passed++;

  // 3. Buffer Inspection: Single-column CSV vs null bytes
  const singleColCsvBuf = Buffer.from("column_header\nvalue1\nvalue2\n", "utf8");
  assert.strictEqual(validateDocumentBuffer(singleColCsvBuf, "csv").valid, true);

  const nullByteBuf = Buffer.from("col1,col2\nval1,\0val2\n", "utf8");
  assert.strictEqual(validateDocumentBuffer(nullByteBuf, "csv").valid, false);
  console.log("  ✅ Buffer inspection accepts single-column CSV and rejects null byte injections");
  passed++;

  // 4. Chat Request Schema
  const validChat = chatRequestSchema.safeParse({
    question: "What was the total revenue in Q3?",
    topK: 5,
    threshold: 0.65,
  });
  assert.strictEqual(validChat.success, true);

  const emptyChat = chatRequestSchema.safeParse({
    question: "   ",
  });
  assert.strictEqual(emptyChat.success, false);

  const invalidThresholdChat = chatRequestSchema.safeParse({
    question: "Valid question?",
    threshold: 1.5,
  });
  assert.strictEqual(invalidThresholdChat.success, false);
  console.log("  ✅ Chat validation bounds question length, topK, and similarity thresholds");
  passed++;

  // 5. Document Permission Schemas
  const validShare = shareDocumentSchema.safeParse({
    email: "Colleague@Example.COM",
    permission: "write",
  });
  assert.strictEqual(validShare.success, true);
  assert.strictEqual(validShare.data.email, "colleague@example.com"); // Normalized to lowercase

  const invalidEmailShare = shareDocumentSchema.safeParse({
    email: "not-an-email",
    permission: "read",
  });
  assert.strictEqual(invalidEmailShare.success, false);

  const invalidRoleShare = shareDocumentSchema.safeParse({
    email: "user@example.com",
    permission: "owner", // Only read/write can be shared
  });
  assert.strictEqual(invalidRoleShare.success, false);

  const validUpdate = updatePermissionSchema.safeParse({ permission: "read" });
  assert.strictEqual(validUpdate.success, true);
  console.log("  ✅ Sharing permissions enforce strict email format and read/write roles");
  passed++;

  // 6. Comparison Schema: Distinct Documents Refinement
  const docA = crypto.randomUUID();
  const docB = crypto.randomUUID();

  const distinctComp = compareDocumentsRequestSchema.safeParse({
    sourceDocumentId: docA,
    targetDocumentId: docB,
  });
  assert.strictEqual(distinctComp.success, true);

  const selfComp = compareDocumentsRequestSchema.safeParse({
    sourceDocumentId: docA,
    targetDocumentId: docA,
  });
  assert.strictEqual(selfComp.success, false);
  assert(selfComp.error.issues[0].message.includes("Cannot compare a document to itself"));
  console.log("  ✅ Comparison schema strictly rejects comparing a document to itself");
  passed++;

  // 7. Admin Schemas
  const validAdminQuery = adminUsersQuerySchema.safeParse({
    page: "2",
    limit: "10",
    role: "admin",
    sortBy: "tokens",
  });
  assert.strictEqual(validAdminQuery.success, true);
  assert.strictEqual(validAdminQuery.data.page, 2);
  assert.strictEqual(validAdminQuery.data.limit, 10);

  const validRoleUpdate = updateUserRoleSchema.safeParse({ role: "admin" });
  assert.strictEqual(validRoleUpdate.success, true);

  const invalidRoleUpdate = updateUserRoleSchema.safeParse({ role: "superadmin" });
  assert.strictEqual(invalidRoleUpdate.success, false);
  console.log("  ✅ Admin queries properly coerce types and enforce strict role enums");
  passed++;

  // 8. Summarize Schema
  const validSummary = summarizeRequestSchema.safeParse({
    summaryType: "executive",
    regenerate: true,
  });
  assert.strictEqual(validSummary.success, true);

  const invalidSummary = summarizeRequestSchema.safeParse({
    summaryType: "invalid_type",
  });
  assert.strictEqual(invalidSummary.success, false);
  console.log("  ✅ Summarize schema validates allowed summary format categories");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("validations.test.mjs")) {
  run().then((r) => {
    console.log(`\nValidation unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Validation unit tests failed:", err);
    process.exit(1);
  });
}
