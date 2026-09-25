import assert from "assert";
import crypto from "crypto";
import { sql, eq } from "drizzle-orm";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../utils/test-db.js";
import { installGeminiTransportGuard } from "../utils/mock-ai.js";
import { users, documents, messages, conversations, aiUsageLogs } from "../../../src/db/schema.js";
import { verifyAdminAccess } from "../../../src/lib/auth/admin.js";

export async function run() {
  console.log("\n--- Integration Tests: Admin Authorization & System Metrics ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("admin_int");
  const adminId = `${testRunId}_admin`;
  const standardUserId = `${testRunId}_standard`;

  let passed = 0;

  try {
    // 1. Create test users: Admin and Standard User
    await createTestUser(db, { id: adminId, email: `${adminId}@documind.test`, name: "System Admin", role: "admin" });
    await createTestUser(db, { id: standardUserId, email: `${standardUserId}@documind.test`, name: "Standard Member", role: "user" });

    // 2. Sole authoritative admin check
    const adminCheck = await verifyAdminAccess(adminId);
    assert.strictEqual(adminCheck.authorized, true);
    assert.strictEqual(adminCheck.adminUser?.role, "admin");

    const userCheck = await verifyAdminAccess(standardUserId);
    assert.strictEqual(userCheck.authorized, false);
    assert.strictEqual(userCheck.errorResponse?.status, 403);

    const anonymousCheck = await verifyAdminAccess("");
    assert.strictEqual(anonymousCheck.authorized, false);
    assert.strictEqual(anonymousCheck.errorResponse?.status, 401);
    console.log("  ✅ verifyAdminAccess strictly honors database users.role === 'admin'");
    passed++;

    // 3. User activity aggregations in a single query (Zero N+1)
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      userId: standardUserId,
      filename: "sample.txt",
      fileType: "txt",
      fileSize: 100,
      storageUrl: "local://documents/test/sample.txt",
      processingStatus: "completed",
    });

    const convId = crypto.randomUUID();
    await db.insert(conversations).values({
      id: convId,
      userId: standardUserId,
      title: "Activity Tracking",
    });

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      conversationId: convId,
      role: "user",
      content: "Sample question?",
    });

    await db.insert(aiUsageLogs).values({
      userId: standardUserId,
      operation: "chat",
      model: "gemini-1.5-flash",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });

    const [aggregatedUser] = await db
      .select({
        id: users.id,
        role: users.role,
        documentCount: sql`(SELECT COUNT(*)::int FROM documents d WHERE d.user_id = users.id)`,
        questionsCount: sql`(
          SELECT COUNT(*)::int FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = users.id AND m.role = 'user'
        )`,
        tokensUsed: sql`(SELECT COALESCE(SUM(l.total_tokens), 0)::bigint FROM ai_usage_logs l WHERE l.user_id = users.id)`,
      })
      .from(users)
      .where(eq(users.id, standardUserId));

    assert.strictEqual(Number(aggregatedUser.documentCount), 1);
    assert.strictEqual(Number(aggregatedUser.questionsCount), 1);
    assert.strictEqual(Number(aggregatedUser.tokensUsed), 150);
    console.log("  ✅ User directory accurately aggregates document count, question count, and token usage");
    passed++;

    // 4. Role promotion of standard member
    await db.update(users).set({ role: "admin" }).where(eq(users.id, standardUserId));
    const newlyPromotedCheck = await verifyAdminAccess(standardUserId);
    assert.strictEqual(newlyPromotedCheck.authorized, true);
    console.log("  ✅ User promotion in PostgreSQL immediately reflects in admin authorization");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("admin-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nAdmin API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Admin API integration tests failed:", err);
    process.exit(1);
  });
}
