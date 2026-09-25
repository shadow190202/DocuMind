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
import { users, documents, documentChunks } from "../../../src/db/schema.js";
import { saveFile, deleteFile } from "../../../src/lib/storage.js";
import { toClientSafeDocument } from "../../../src/lib/auth/permissions.js";

export async function run() {
  console.log("\n--- Integration Tests: Documents API & Lifecycle ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("docs_int");
  const testUserId = `${testRunId}_owner`;

  let passed = 0;
  let savedStorageUrl = null;

  try {
    // 1. Create test user
    await createTestUser(db, {
      id: testUserId,
      email: `${testUserId}@documind.test`,
      name: "Doc Owner User",
      role: "user",
    });

    // 2. Save document file into isolated storage
    const fileContent = Buffer.from("Integration test document text payload with multiple sections.", "utf8");
    const saveResult = await saveFile(fileContent, "test-contract.txt", testUserId);
    savedStorageUrl = saveResult.storageUrl;
    assert(savedStorageUrl.startsWith("local://documents/"));
    console.log("  ✅ Storage subsystem securely saves document file");
    passed++;

    // 3. Insert document record in PostgreSQL
    const docId = crypto.randomUUID();
    const [docRecord] = await db
      .insert(documents)
      .values({
        id: docId,
        userId: testUserId,
        filename: "test-contract.txt",
        fileType: "txt",
        fileSize: fileContent.length,
        storageUrl: savedStorageUrl,
        processingStatus: "completed",
      })
      .returning();

    assert.strictEqual(docRecord.id, docId);
    assert.strictEqual(docRecord.userId, testUserId);
    console.log("  ✅ Document record successfully persisted in PostgreSQL");
    passed++;

    // 4. Insert associated document chunks
    const [chunk1] = await db
      .insert(documentChunks)
      .values({
        documentId: docId,
        chunkIndex: 0,
        content: "Integration test document text payload.",
        characterCount: 39,
        estimatedTokenCount: 10,
        embedding: null,
      })
      .returning();

    assert.strictEqual(chunk1.documentId, docId);
    console.log("  ✅ Document chunk correctly linked via foreign key");
    passed++;

    // 5. Query user documents and verify isolation
    const userDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.userId, testUserId));

    assert.strictEqual(userDocs.length, 1);
    assert.strictEqual(userDocs[0].filename, "test-contract.txt");
    console.log("  ✅ Document listings enforce user data isolation");
    passed++;

    // 6. Verify client-safe serialization (strips server-only fields)
    const clientSafe = toClientSafeDocument(docRecord, { userId: testUserId, isOwner: true, role: "owner" });
    assert.strictEqual(clientSafe.id, docId);
    assert.strictEqual(clientSafe.filename, "test-contract.txt");
    assert.strictEqual(clientSafe.storageUrl, undefined); // Strictly stripped
    assert.strictEqual(clientSafe.isOwner, true);
    assert.strictEqual(clientSafe.role, "owner");
    console.log("  ✅ toClientSafeDocument strips storageUrl and internal fields from client payload");
    passed++;

    // 7. Verify cascade deletion of document and chunks
    await db.delete(documents).where(eq(documents.id, docId));

    const remainingChunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, docId));
    assert.strictEqual(remainingChunks.length, 0);
    console.log("  ✅ Deleting document cascades cleanly to all associated chunks");
    passed++;

    // 8. Clean up physical file
    if (savedStorageUrl) {
      await deleteFile(savedStorageUrl);
      savedStorageUrl = null;
    }
  } finally {
    if (savedStorageUrl) {
      try {
        await deleteFile(savedStorageUrl);
      } catch {}
    }
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("documents-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nDocuments API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Documents API integration tests failed:", err);
    process.exit(1);
  });
}
