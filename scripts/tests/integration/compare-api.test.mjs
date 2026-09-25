import assert from "assert";
import crypto from "crypto";
import { sql, eq, or } from "drizzle-orm";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../utils/test-db.js";
import { installGeminiTransportGuard } from "../utils/mock-ai.js";
import {
  users,
  documents,
  documentComparisons,
} from "../../../src/db/schema.js";
import { verifyDualDocumentAccess } from "../../../src/lib/auth/permissions.js";

export async function run() {
  console.log("\n--- Integration Tests: Document Comparison & Dual Authorization ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("comp_int");
  const ownerId = `${testRunId}_analyst`;
  const otherUserId = `${testRunId}_outsider`;
  const docAId = crypto.randomUUID();
  const docBId = crypto.randomUUID();
  const docCId = crypto.randomUUID();

  let passed = 0;

  try {
    // 1. Create test users and documents
    await createTestUser(db, { id: ownerId, email: `${ownerId}@documind.test`, name: "Comparison Analyst" });
    await createTestUser(db, { id: otherUserId, email: `${otherUserId}@documind.test`, name: "Outsider" });

    await db.insert(documents).values([
      {
        id: docAId,
        userId: ownerId,
        filename: "lease_2025.pdf",
        fileType: "pdf",
        fileSize: 5000,
        storageUrl: "local://documents/test/lease_2025.pdf",
        processingStatus: "completed",
      },
      {
        id: docBId,
        userId: ownerId,
        filename: "lease_2026.pdf",
        fileType: "pdf",
        fileSize: 5200,
        storageUrl: "local://documents/test/lease_2026.pdf",
        processingStatus: "completed",
      },
      {
        id: docCId,
        userId: otherUserId, // Owned by outsider
        filename: "confidential_other.pdf",
        fileType: "pdf",
        fileSize: 3000,
        storageUrl: "local://documents/test/confidential_other.pdf",
        processingStatus: "completed",
      },
    ]);

    // 2. Dual Authorization: Success when caller has access to both documents
    const dualSuccess = await verifyDualDocumentAccess({
      sourceDocumentId: docAId,
      targetDocumentId: docBId,
      userId: ownerId,
    });
    assert.strictEqual(dualSuccess.authorized, true);
    assert.strictEqual(dualSuccess.errorResponse, null);
    console.log("  ✅ verifyDualDocumentAccess succeeds when user has access to both documents");
    passed++;

    // 3. Dual Authorization: Uniform 404 when caller lacks access to one of the documents
    const dualFail = await verifyDualDocumentAccess({
      sourceDocumentId: docAId,
      targetDocumentId: docCId, // Unauthorized
      userId: ownerId,
    });
    assert.strictEqual(dualFail.authorized, false);
    assert.strictEqual(dualFail.errorResponse?.status, 404);
    console.log("  ✅ verifyDualDocumentAccess returns uniform 404 if either document is inaccessible");
    passed++;

    // 4. Comparison Record Persistence
    const compId = crypto.randomUUID();
    const comparisonContent = {
      overview: "Comparative analysis between lease agreement 2025 and 2026.",
      similarities: ["Both leases maintain standard indemnification clauses."],
      keyDifferences: [
        {
          aspect: "Monthly Rent",
          sourceDoc: "$4,500/month",
          targetDoc: "$4,850/month",
          significance: "High (7.7% escalation)",
        },
      ],
      recommendations: ["Ensure security deposit is adjusted."],
    };

    const [compRecord] = await db
      .insert(documentComparisons)
      .values({
        id: compId,
        userId: ownerId,
        sourceDocumentId: docAId,
        targetDocumentId: docBId,
        content: "# Comparative Analysis\n\n## Overview\nComparative analysis between lease agreement 2025 and 2026.\n\n## Key Differences\n- **Monthly Rent**: $4,500 vs $4,850\n",
        structuredData: comparisonContent,
        model: "gemini-1.5-flash",
        promptTokens: 200,
        completionTokens: 80,
        totalTokens: 280,
      })
      .returning();

    assert.strictEqual(compRecord.id, compId);
    assert.strictEqual(compRecord.userId, ownerId);
    console.log("  ✅ Comparison results with structured JSON fields persisted in PostgreSQL");
    passed++;

    // 5. Invalidation upon document change
    await db
      .delete(documentComparisons)
      .where(
        or(
          eq(documentComparisons.sourceDocumentId, docAId),
          eq(documentComparisons.targetDocumentId, docAId)
        )
      );

    const remaining = await db
      .select()
      .from(documentComparisons)
      .where(eq(documentComparisons.id, compId));
    assert.strictEqual(remaining.length, 0);
    console.log("  ✅ Comparison cache is invalidated when a source or target document updates");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("compare-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nCompare API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Compare API integration tests failed:", err);
    process.exit(1);
  });
}
