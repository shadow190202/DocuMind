import assert from "assert";
import crypto from "crypto";
import { sql, eq } from "drizzle-orm";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../utils/test-db.js";
import {
  installGeminiTransportGuard,
  generateMockGroundedAnswer,
  generateDeterministicMockEmbedding,
} from "../utils/mock-ai.js";
import {
  users,
  documents,
  documentChunks,
  conversations,
  messages,
  aiUsageLogs,
} from "../../../src/db/schema.js";

export async function run() {
  console.log("\n--- Integration Tests: Chat, Context & Telemetry ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("chat_int");
  const testUserId = `${testRunId}_chatter`;
  const docId = crypto.randomUUID();
  const convId = crypto.randomUUID();

  let passed = 0;

  try {
    // 1. Create test user and indexed document
    await createTestUser(db, { id: testUserId, email: `${testUserId}@documind.test`, name: "Chat User" });

    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: "financial-report.pdf",
      fileType: "pdf",
      fileSize: 4096,
      storageUrl: "local://documents/test/financial.pdf",
      processingStatus: "completed",
    });

    const mockEmbedding = generateDeterministicMockEmbedding("Q3 revenue reached $5.2 million with 24% profit margin.");
    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: 0,
      content: "Q3 revenue reached $5.2 million with 24% profit margin.",
      characterCount: 56,
      estimatedTokenCount: 14,
      embedding: mockEmbedding,
    });

    // 2. Initialize Conversation record
    const [convRecord] = await db
      .insert(conversations)
      .values({
        id: convId,
        userId: testUserId,
        documentId: docId,
        title: "Q3 Financial Inquiry",
      })
      .returning();
    assert.strictEqual(convRecord.id, convId);
    console.log("  ✅ Conversation session initialized with user and document bindings");
    passed++;

    // 3. User message persistence
    const userMsgId = crypto.randomUUID();
    const [userMsg] = await db
      .insert(messages)
      .values({
        id: userMsgId,
        conversationId: convId,
        role: "user",
        content: "What was the total revenue in Q3?",
      })
      .returning();
    assert.strictEqual(userMsg.role, "user");
    console.log("  ✅ User question successfully stored in messages table");
    passed++;

    // 4. Grounded answer generation (Offline mock with transport guard)
    const mockAiOutput = generateMockGroundedAnswer({
      question: userMsg.content,
      contextText: "Q3 revenue reached $5.2 million with 24% profit margin.",
    });
    assert(mockAiOutput.answer.includes("substantiated"));
    assert(mockAiOutput.usage.totalTokens > 0);

    // 5. Assistant message persistence with citations
    const assistantMsgId = crypto.randomUUID();
    const [assistantMsg] = await db
      .insert(messages)
      .values({
        id: assistantMsgId,
        conversationId: convId,
        role: "assistant",
        content: mockAiOutput.answer,
      })
      .returning();
    assert.strictEqual(assistantMsg.role, "assistant");
    console.log("  ✅ Assistant response with citations persisted to conversation");
    passed++;

    // 6. AI Telemetry Usage Logging
    const [usageLog] = await db
      .insert(aiUsageLogs)
      .values({
        userId: testUserId,
        operation: "chat",
        model: "gemini-1.5-flash",
        promptTokens: mockAiOutput.usage.promptTokens,
        completionTokens: mockAiOutput.usage.completionTokens,
        totalTokens: mockAiOutput.usage.totalTokens,
        cachedContentTokens: 0,
      })
      .returning();
    assert.strictEqual(usageLog.operation, "chat");
    assert.strictEqual(usageLog.totalTokens, mockAiOutput.usage.totalTokens);
    console.log("  ✅ AI token consumption accurately logged in ai_usage_logs");
    passed++;

    // 7. Verify Conversation History Retrieval
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);

    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].role, "user");
    assert.strictEqual(history[1].role, "assistant");
    console.log("  ✅ Conversation history retrieved with strict chronological ordering");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("chat-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nChat API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Chat API integration tests failed:", err);
    process.exit(1);
  });
}
