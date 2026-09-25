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
import {
  users,
  documents,
  documentPermissions,
} from "../../../src/db/schema.js";
import { verifyDocumentAccess } from "../../../src/lib/auth/permissions.js";

export async function run() {
  console.log("\n--- Integration Tests: Document Sharing & Permissions Hierarchy ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("perm_int");
  const ownerId = `${testRunId}_owner`;
  const collaboratorId = `${testRunId}_collab`;
  const strangerId = `${testRunId}_stranger`;
  const docId = crypto.randomUUID();

  let passed = 0;

  try {
    // 1. Create test users: owner, collaborator, stranger
    await createTestUser(db, { id: ownerId, email: `${ownerId}@documind.test`, name: "Owner User" });
    await createTestUser(db, { id: collaboratorId, email: `${collaboratorId}@documind.test`, name: "Collab User" });
    await createTestUser(db, { id: strangerId, email: `${strangerId}@documind.test`, name: "Stranger User" });

    // 2. Insert document owned by owner
    await db.insert(documents).values({
      id: docId,
      userId: ownerId,
      filename: "confidential-roadmap.pdf",
      fileType: "pdf",
      fileSize: 2048,
      storageUrl: "local://documents/test/confidential.pdf",
      processingStatus: "completed",
    });

    // 3. Verify Owner Access (Satisfies owner, write, and read)
    const ownerCheck = await verifyDocumentAccess({ documentId: docId, userId: ownerId, requiredPermission: "owner" });
    assert.strictEqual(ownerCheck.authorized, true);
    assert.strictEqual(ownerCheck.isOwner, true);
    assert.strictEqual(ownerCheck.role, "owner");

    const ownerWriteCheck = await verifyDocumentAccess({ documentId: docId, userId: ownerId, requiredPermission: "write" });
    assert.strictEqual(ownerWriteCheck.authorized, true);
    console.log("  ✅ Owner authoritatively satisfies owner, write, and read levels");
    passed++;

    // 4. Stranger Access Attempt (Zero permissions -> Uniform 404 anti-probing defense)
    const strangerCheck = await verifyDocumentAccess({ documentId: docId, userId: strangerId, requiredPermission: "read" });
    assert.strictEqual(strangerCheck.authorized, false);
    assert.strictEqual(strangerCheck.errorResponse?.status, 404);
    console.log("  ✅ Unrelated caller receives uniform 404 to prevent IDOR existence probing");
    passed++;

    // 5. Grant Viewer ('read') Permission to Collaborator
    const [permRecord] = await db
      .insert(documentPermissions)
      .values({
        documentId: docId,
        userId: collaboratorId,
        permission: "read",
      })
      .returning();
    assert.strictEqual(permRecord.permission, "read");

    // Viewer read check -> 200 / authorized: true
    const collabReadCheck = await verifyDocumentAccess({ documentId: docId, userId: collaboratorId, requiredPermission: "read" });
    assert.strictEqual(collabReadCheck.authorized, true);
    assert.strictEqual(collabReadCheck.role, "read");
    assert.strictEqual(collabReadCheck.isOwner, false);

    // Viewer write check -> 403 Forbidden
    const collabWriteCheck = await verifyDocumentAccess({ documentId: docId, userId: collaboratorId, requiredPermission: "write" });
    assert.strictEqual(collabWriteCheck.authorized, false);
    assert.strictEqual(collabWriteCheck.errorResponse?.status, 403);
    console.log("  ✅ Collaborator with 'read' access succeeds on read and receives 403 on write");
    passed++;

    // 6. Promote Collaborator to Editor ('write')
    await db
      .update(documentPermissions)
      .set({ permission: "write" })
      .where(eq(documentPermissions.id, permRecord.id));

    const collabPromotedCheck = await verifyDocumentAccess({ documentId: docId, userId: collaboratorId, requiredPermission: "write" });
    assert.strictEqual(collabPromotedCheck.authorized, true);
    assert.strictEqual(collabPromotedCheck.role, "write");
    console.log("  ✅ Collaborator promoted to 'write' successfully satisfies write operations");
    passed++;

    // 7. Revoke Collaborator Permission
    await db.delete(documentPermissions).where(eq(documentPermissions.id, permRecord.id));

    const collabRevokedCheck = await verifyDocumentAccess({ documentId: docId, userId: collaboratorId, requiredPermission: "read" });
    assert.strictEqual(collabRevokedCheck.authorized, false);
    assert.strictEqual(collabRevokedCheck.errorResponse?.status, 404);
    console.log("  ✅ Revoking permission immediately drops access back to 404");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("permissions-api.test.mjs")) {
  run().then((r) => {
    console.log(`\nPermissions API integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Permissions API integration tests failed:", err);
    process.exit(1);
  });
}
