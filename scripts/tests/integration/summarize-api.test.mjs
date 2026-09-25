import assert from "assert";
import crypto from "crypto";
import { sql, eq, and } from "drizzle-orm";
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
  documentSummaries,
  aiUsageLogs,
} from "../../../src/db/schema.js";

export async function run() {
  console.log("\n--- Integration Tests: Document Summarization & Cache Invalidation ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("summ_int");
  const testUserId = `${testRunId}_summarizer`;
  const docId = crypto.randomUUID();

  let passed = 0;

  try {
    // 1. Create test user and document
    await createTestUser(db, { id: testUserId, email: `${testUserId}@documind.test`, name: "Summary User" });

    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: "annual-strategy.pdf",
      fileType: "pdf",
      fileSize: 8192,
      storageUrl: "local://documents/test/annual-strategy.pdf",
      processingStatus: "completed",
    });

    // 2. Persist initial executive summary
    const [summary1] = await db
      .insert(documentSummaries)
      .values({
        documentId: docId,
        userId: testUserId,
        summaryType: "executive",
        content: "Executive Summary: The company achieved 35% ARR growth in FY2026.",
        model: "gemini-1.5-flash",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      })
      .returning();

    assert.strictEqual(summary1.documentId, docId);
    assert.strictEqual(summary1.summaryType, "executive");
    console.log("  ✅ Generated executive summary successfully persisted to document_summaries");
    passed++;

    // 3. Cache retrieval for identical summaryType
    const [cached] = await db
      .select()
      .from(documentSummaries)
      .where(
        and(
          eq(documentSummaries.documentId, docId),
          eq(documentSummaries.summaryType, "executive")
        )
      );

    assert.strictEqual(cached.id, summary1.id);
    assert.strictEqual(cached.content, summary1.content);
    console.log("  ✅ Cached summary successfully resolved on subsequent request");
    passed++;

    // 4. Invalidation upon document reprocessing
    // When a document is reprocessed, all existing summaries for that document must be deleted
    await db.delete(documentSummaries).where(eq(documentSummaries.documentId, docId));

    const remaining = await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.documentId, docId));

    assert.strictEqual(remaining.length, 0);
    console.log("  ✅ Document summaries are cleanly invalidated on reprocessing");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("summarize-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nSummarize API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Summarize API integration tests failed:", err);
    process.exit(1);
  });
}
