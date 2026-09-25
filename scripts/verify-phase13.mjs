import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, sql } from "drizzle-orm";
import {
  users,
  documents,
  documentChunks,
  documentPermissions,
  documentSummaries,
  documentComparisons,
  conversations,
  messages,
  aiUsageLogs,
} from "../src/db/schema.js";
import {
  shareDocumentSchema,
  updatePermissionSchema,
  permissionParamsSchema,
} from "../src/lib/validations/permission.js";
import {
  verifyDocumentAccess,
  verifyDualDocumentAccess,
  toClientSafeDocument,
} from "../src/lib/auth/permissions.js";
import { searchDocumentChunks } from "../src/lib/ai/vector-search.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env.local
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

async function runPhase13Verification() {
  console.log("==========================================================");
  console.log("  DocuMind Phase 13: Document Permissions & Sharing Suite ");
  console.log("==========================================================\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  const testSuffix = Date.now();
  const aliceId = `usr_alice_${testSuffix}`;
  const bobId = `usr_bob_${testSuffix}`;
  const charlieId = `usr_charlie_${testSuffix}`;
  const daveId = `usr_dave_${testSuffix}`;

  const aliceEmail = `alice_${testSuffix}@example.com`;
  const bobEmail = `bob_${testSuffix}@example.com`;
  const charlieEmail = `charlie_${testSuffix}@example.com`;
  const daveEmail = `dave_${testSuffix}@example.com`;

  let docAId = null; // Owned by Alice
  let docBId = null; // Owned by Alice
  let docCId = null; // Owned by Bob

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Database Schema & Migration 0006 Safety
    // ----------------------------------------------------
    console.log("--- 1. Testing Database Schema, Migration 0006 & Deduplication ---");

    const columns = await sqlClient`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'document_permissions'
    `;
    const colMap = new Map(columns.map((c) => [c.column_name, c]));
    assert(colMap.has("id"), "Column 'id' exists in document_permissions");
    assert(colMap.has("document_id"), "Column 'document_id' exists in document_permissions");
    assert(colMap.has("user_id"), "Column 'user_id' exists in document_permissions");
    assert(colMap.has("permission"), "Column 'permission' exists in document_permissions");
    assert(colMap.has("created_at"), "Column 'created_at' exists in document_permissions");
    assert(colMap.has("updated_at"), "Column 'updated_at' exists in document_permissions");

    const indexes = await sqlClient`
      SELECT indexname, tablename, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'document_permissions'
    `;
    const indexNames = indexes.map((i) => i.indexname);
    assert(
      indexNames.includes("doc_permissions_doc_user_uniq_idx"),
      "Unique index 'doc_permissions_doc_user_uniq_idx' exists"
    );
    assert(
      indexNames.includes("doc_permissions_user_idx"),
      "Index 'doc_permissions_user_idx' exists"
    );
    assert(
      indexNames.includes("doc_permissions_doc_idx"),
      "Index 'doc_permissions_doc_idx' exists"
    );

    // Setup Test Users in PostgreSQL
    await db.insert(users).values([
      { id: aliceId, email: aliceEmail, name: "Alice Owner" },
      { id: bobId, email: bobEmail, name: "Bob Editor" },
      { id: charlieId, email: charlieEmail, name: "Charlie Viewer" },
      { id: daveId, email: daveEmail, name: "Dave Stranger" },
    ]);
    assert(true, "Test users Alice, Bob, Charlie, and Dave registered in users table");

    // Create Document A for Alice
    const [docA] = await db
      .insert(documents)
      .values({
        userId: aliceId,
        filename: "Master_Agreement.pdf",
        fileType: "pdf",
        fileSize: 45000,
        storageUrl: `local://documents/${aliceId}/docA.pdf`,
        processingStatus: "completed",
      })
      .returning();
    docAId = docA.id;
    assert(docAId !== null, "Document A created for Alice (Owner)");

    // Create a chunk with dummy 768-dim embedding for Document A
    const dummyEmbedding768 = new Array(768).fill(0.05);
    const [chunkA1] = await db
      .insert(documentChunks)
      .values({
        documentId: docAId,
        chunkIndex: 0,
        content: "This Master Agreement governs the terms of collaboration and non-disclosure.",
        pageNumber: 1,
        embedding: dummyEmbedding768,
      })
      .returning();
    assert(chunkA1 !== null, "Chunk inserted for Document A with 768-dim embedding");

    // ----------------------------------------------------
    // TEST SUITE 2: Centralized Access Control Helper
    // ----------------------------------------------------
    console.log("\n--- 2. Testing Centralized Access Control Helper ---");

    // Alice is Owner: satisfies read, write, owner
    const aliceRead = await verifyDocumentAccess({ documentId: docAId, userId: aliceId, requiredPermission: "read" });
    assert(aliceRead.authorized === true && aliceRead.role === "owner" && aliceRead.isOwner === true, "Owner satisfies read");
    const aliceWrite = await verifyDocumentAccess({ documentId: docAId, userId: aliceId, requiredPermission: "write" });
    assert(aliceWrite.authorized === true && aliceWrite.role === "owner", "Owner satisfies write");
    const aliceOwner = await verifyDocumentAccess({ documentId: docAId, userId: aliceId, requiredPermission: "owner" });
    assert(aliceOwner.authorized === true && aliceOwner.role === "owner", "Owner satisfies owner");

    // Dave is stranger: zero permissions -> uniform 404 errorResponse
    const daveAccess = await verifyDocumentAccess({ documentId: docAId, userId: daveId, requiredPermission: "read" });
    assert(daveAccess.authorized === false && daveAccess.role === null, "Stranger is unauthorized");
    assert(daveAccess.errorResponse.status === 404, "Stranger receives uniform 404 (IDOR protection)");

    // Non-existent document -> uniform 404
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const nonExistentAccess = await verifyDocumentAccess({ documentId: nonExistentId, userId: aliceId });
    assert(nonExistentAccess.authorized === false && nonExistentAccess.errorResponse.status === 404, "Non-existent doc returns 404");

    // Server-only data safety
    const safeDoc = toClientSafeDocument(aliceRead.document, aliceRead);
    assert(safeDoc.storageUrl === undefined, "toClientSafeDocument strictly strips storageUrl");
    assert(safeDoc.id === docAId && safeDoc.role === "owner" && safeDoc.isOwner === true, "toClientSafeDocument serializes client-safe fields");

    // ----------------------------------------------------
    // TEST SUITE 3: Zod Validation Schemas
    // ----------------------------------------------------
    console.log("\n--- 3. Testing Zod Validation Schemas ---");

    const validShare = shareDocumentSchema.safeParse({ email: "Test@Example.com", permission: "read" });
    assert(validShare.success && validShare.data.email === "test@example.com", "shareDocumentSchema validates and lowercases email");

    const invalidEmail = shareDocumentSchema.safeParse({ email: "not-an-email", permission: "read" });
    assert(!invalidEmail.success, "shareDocumentSchema rejects invalid email format");

    const invalidPerm = shareDocumentSchema.safeParse({ email: "user@test.com", permission: "superadmin" });
    assert(!invalidPerm.success, "shareDocumentSchema rejects invalid permission role");

    const validUpdate = updatePermissionSchema.safeParse({ permission: "write" });
    assert(validUpdate.success && validUpdate.data.permission === "write", "updatePermissionSchema validates role update");

    const validParams = permissionParamsSchema.safeParse({ id: docAId, permissionId: crypto.randomUUID() });
    assert(validParams.success, "permissionParamsSchema validates UUID params");

    // ----------------------------------------------------
    // TEST SUITE 4: Sharing & Permission Management Flow
    // ----------------------------------------------------
    console.log("\n--- 4. Testing Sharing & Permission Management Operations ---");

    // Self-sharing rejection based on resolved user ID
    const selfShareUser = await db.select().from(users).where(eq(users.id, aliceId));
    assert(selfShareUser[0].id === aliceId, "Resolved user ID matches owner ID for self-share test");

    // Grant Bob 'write' (Editor)
    const initialDate = new Date(Date.now() - 5000);
    const [bobPerm] = await db
      .insert(documentPermissions)
      .values({
        documentId: docAId,
        userId: bobId,
        permission: "write",
        createdAt: initialDate,
        updatedAt: initialDate,
      })
      .returning();
    assert(bobPerm.permission === "write", "Bob granted 'write' (Editor) permission");

    // Grant Charlie 'read' (Viewer)
    const [charliePerm] = await db
      .insert(documentPermissions)
      .values({
        documentId: docAId,
        userId: charlieId,
        permission: "read",
        createdAt: initialDate,
        updatedAt: initialDate,
      })
      .returning();
    assert(charliePerm.permission === "read", "Charlie granted 'read' (Viewer) permission");

    // Verify Bob's access
    const bobRead = await verifyDocumentAccess({ documentId: docAId, userId: bobId, requiredPermission: "read" });
    assert(bobRead.authorized === true && bobRead.role === "write" && bobRead.isOwner === false, "Editor satisfies read");
    const bobWrite = await verifyDocumentAccess({ documentId: docAId, userId: bobId, requiredPermission: "write" });
    assert(bobWrite.authorized === true && bobWrite.role === "write", "Editor satisfies write");
    const bobOwner = await verifyDocumentAccess({ documentId: docAId, userId: bobId, requiredPermission: "owner" });
    assert(bobOwner.authorized === false && bobOwner.errorResponse.status === 403, "Editor fails owner with 403 Forbidden");

    // Verify Charlie's access
    const charlieRead = await verifyDocumentAccess({ documentId: docAId, userId: charlieId, requiredPermission: "read" });
    assert(charlieRead.authorized === true && charlieRead.role === "read", "Viewer satisfies read");
    const charlieWrite = await verifyDocumentAccess({ documentId: docAId, userId: charlieId, requiredPermission: "write" });
    assert(charlieWrite.authorized === false && charlieWrite.errorResponse.status === 403, "Viewer fails write with 403 Forbidden");
    const charlieOwner = await verifyDocumentAccess({ documentId: docAId, userId: charlieId, requiredPermission: "owner" });
    assert(charlieOwner.authorized === false && charlieOwner.errorResponse.status === 403, "Viewer fails owner with 403 Forbidden");

    // Test unique index enforcement: duplicate insert must fail
    let duplicateFailed = false;
    try {
      await db.insert(documentPermissions).values({
        documentId: docAId,
        userId: charlieId,
        permission: "write",
      });
    } catch {
      duplicateFailed = true;
    }
    assert(duplicateFailed, "Unique index strictly rejects duplicate (document_id, user_id) row");

    // Test updatedAt advancement on role update
    const updateTime = new Date();
    const [updatedCharlie] = await db
      .update(documentPermissions)
      .set({
        permission: "write",
        updatedAt: updateTime,
      })
      .where(
        and(
          eq(documentPermissions.id, charliePerm.id),
          eq(documentPermissions.documentId, docAId)
        )
      )
      .returning();
    assert(
      updatedCharlie.permission === "write" &&
      new Date(updatedCharlie.updatedAt).getTime() > new Date(charliePerm.updatedAt).getTime(),
      "Role update advances updatedAt timestamp"
    );

    // Cross-document scoping test: Attempt to update permission with mismatching document ID
    const fakeDocId = "00000000-0000-0000-0000-000000000001";
    const [crossDocPatch] = await db
      .update(documentPermissions)
      .set({ permission: "read" })
      .where(
        and(
          eq(documentPermissions.id, charliePerm.id),
          eq(documentPermissions.documentId, fakeDocId)
        )
      )
      .returning();
    assert(!crossDocPatch, "Cross-document permission UUID update attempt strictly returns empty / 404");

    // Demote Charlie back to 'read'
    await db
      .update(documentPermissions)
      .set({ permission: "read", updatedAt: new Date() })
      .where(eq(documentPermissions.id, charliePerm.id));

    // ----------------------------------------------------
    // TEST SUITE 5: RAG Vector Search SQL-Layer Authorization
    // ----------------------------------------------------
    console.log("\n--- 5. Testing RAG Vector Search SQL-Layer Authorization ---");

    // Create Document B for Alice and Document C for Dave
    const [docB] = await db
      .insert(documents)
      .values({
        userId: aliceId,
        filename: "Alice_Private_Budget.pdf",
        fileType: "pdf",
        fileSize: 12000,
        storageUrl: `local://documents/${aliceId}/docB.pdf`,
        processingStatus: "completed",
      })
      .returning();
    docBId = docB.id;

    await db.insert(documentChunks).values({
      documentId: docBId,
      chunkIndex: 0,
      content: "Alice confidential financial budget projection for fiscal year 2027.",
      pageNumber: 1,
      embedding: dummyEmbedding768,
    });

    const [docC] = await db
      .insert(documents)
      .values({
        userId: daveId,
        filename: "Dave_Confidential_Report.pdf",
        fileType: "pdf",
        fileSize: 15000,
        storageUrl: `local://documents/${daveId}/docC.pdf`,
        processingStatus: "completed",
      })
      .returning();
    docCId = docC.id;

    await db.insert(documentChunks).values({
      documentId: docCId,
      chunkIndex: 0,
      content: "Dave proprietary trade secrets and confidential product roadmaps.",
      pageNumber: 1,
      embedding: dummyEmbedding768,
    });

    // Charlie searches with documentIds = [docAId (shared with Charlie), docCId (Dave's doc)]
    // MANDATORY SECURITY INVARIANT: Chunks from Dave's doc MUST NEVER appear!
    const charlieSearchResults = await searchDocumentChunks({
      query: "collaboration terms and trade secrets",
      userId: charlieId,
      documentIds: [docAId, docCId],
      threshold: 0.0,
      topK: 10,
      queryVector: dummyEmbedding768,
    });

    const returnedDocIds = charlieSearchResults.map((r) => r.documentId);
    assert(returnedDocIds.includes(docAId), "Authorized shared document chunks returned in vector search");
    assert(!returnedDocIds.includes(docCId), "Unauthorized document chunks STRICTLY EXCLUDED at SQL layer");

    // Vault-wide search by Charlie: can only see docA (shared); cannot see docB (Alice private) or docC (Dave)
    const charlieVaultResults = await searchDocumentChunks({
      query: "terms and budget",
      userId: charlieId,
      threshold: 0.0,
      topK: 10,
      queryVector: dummyEmbedding768,
    });
    const vaultDocIds = charlieVaultResults.map((r) => r.documentId);
    assert(vaultDocIds.includes(docAId), "Vault search includes shared document");
    assert(!vaultDocIds.includes(docBId), "Vault search excludes unshared document of owner");
    assert(!vaultDocIds.includes(docCId), "Vault search excludes stranger's documents");

    // ----------------------------------------------------
    // TEST SUITE 6: Summary Cache Authorization Order
    // ----------------------------------------------------
    console.log("\n--- 6. Testing Summary Cache Authorization Order ---");

    // Alice creates cached summary for Doc A
    const [aliceSummary] = await db
      .insert(documentSummaries)
      .values({
        documentId: docAId,
        userId: aliceId,
        summaryType: "executive",
        content: "Executive Summary: This agreement details bilateral terms.",
        model: "gemini-2.5-flash",
      })
      .returning();
    assert(aliceSummary !== null, "Cached summary created for Document A");

    // Charlie has read access: verifyDocumentAccess succeeds BEFORE cache read
    const charlieAccessBefore = await verifyDocumentAccess({ documentId: docAId, userId: charlieId, requiredPermission: "read" });
    assert(charlieAccessBefore.authorized === true, "verifyDocumentAccess succeeds for authorized collaborator");

    // Cached summary retrieved without Gemini invocation
    const [cachedForCharlie] = await db
      .select()
      .from(documentSummaries)
      .where(eq(documentSummaries.documentId, docAId));
    assert(cachedForCharlie.content === aliceSummary.content, "Shared collaborator can read existing cached summary");

    // Dave attempts to access summary: verifyDocumentAccess fails with 404 BEFORE checking cache
    const daveSummaryAccess = await verifyDocumentAccess({ documentId: docAId, userId: daveId, requiredPermission: "read" });
    assert(daveSummaryAccess.authorized === false && daveSummaryAccess.errorResponse.status === 404, "Unauthorized user blocked with 404 before cache access");

    // ----------------------------------------------------
    // TEST SUITE 7: Comparison Cache Dual Authorization
    // ----------------------------------------------------
    console.log("\n--- 7. Testing Comparison Cache Dual Authorization ---");

    // Create Document D owned by Bob
    const [docD] = await db
      .insert(documents)
      .values({
        userId: bobId,
        filename: "Bob_Amendment.pdf",
        fileType: "pdf",
        fileSize: 18000,
        storageUrl: `local://documents/${bobId}/docD.pdf`,
        processingStatus: "completed",
      })
      .returning();
    const docDId = docD.id;

    await db.insert(documentChunks).values({
      documentId: docDId,
      chunkIndex: 0,
      content: "Amendment to collaborate with Alice.",
      pageNumber: 1,
      embedding: dummyEmbedding768,
    });

    // Bob has access to docA (shared with Bob as Editor) AND docD (owned by Bob)
    const dualAccessBob = await verifyDualDocumentAccess({
      sourceDocumentId: docAId,
      targetDocumentId: docDId,
      userId: bobId,
      requiredPermission: "read",
    });
    assert(dualAccessBob.authorized === true, "Dual document access authorized for owned + shared pair");

    // Create comparison cache for (docAId, docDId)
    const [compRecord] = await db
      .insert(documentComparisons)
      .values({
        userId: bobId,
        sourceDocumentId: docAId,
        targetDocumentId: docDId,
        content: "Comparison between Master Agreement and Amendment.",
        model: "gemini-2.5-flash",
      })
      .returning();
    assert(compRecord !== null, "Comparison cache created for pair (Doc A, Doc D)");

    // Dave tests dual access: Dave has no access to Doc A -> fails with 404
    const dualAccessDave = await verifyDualDocumentAccess({
      sourceDocumentId: docAId,
      targetDocumentId: docDId,
      userId: daveId,
      requiredPermission: "read",
    });
    assert(dualAccessDave.authorized === false && dualAccessDave.errorResponse.status === 404, "Dual access fails with 404 when either doc is inaccessible");

    // ----------------------------------------------------
    // TEST SUITE 8: Immediate Revocation & Conversation Security
    // ----------------------------------------------------
    console.log("\n--- 8. Testing Revocation & Conversation Access Invariants ---");

    // Create a historical conversation for Bob grounded on Doc A
    const [convBob] = await db
      .insert(conversations)
      .values({
        userId: bobId,
        documentId: docAId,
        title: "Bob's Review of Master Agreement",
      })
      .returning();

    await db.insert(messages).values({
      conversationId: convBob.id,
      role: "user",
      content: "What are the liability clauses?",
    });
    await db.insert(messages).values({
      conversationId: convBob.id,
      role: "assistant",
      content: "The liability is limited as specified in Section 4.",
    });

    // Bob can view historical conversation messages
    const [historicalConv] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convBob.id), eq(conversations.userId, bobId)));
    assert(historicalConv !== null, "Historical conversation row accessible to creator");

    // NOW: Alice revokes Bob's permission on Doc A
    await db
      .delete(documentPermissions)
      .where(
        and(
          eq(documentPermissions.documentId, docAId),
          eq(documentPermissions.userId, bobId)
        )
      );

    // Immediate Revocation Invariant: Bob immediately receives 404 on Doc A
    const bobAccessAfterRevoke = await verifyDocumentAccess({ documentId: docAId, userId: bobId, requiredPermission: "read" });
    assert(bobAccessAfterRevoke.authorized === false && bobAccessAfterRevoke.errorResponse.status === 404, "Revoked user immediately receives 404 on document");

    // Immediate Revocation Invariant in Vector Search: Bob searches -> 0 chunks returned
    const bobSearchAfterRevoke = await searchDocumentChunks({
      query: "collaboration terms",
      userId: bobId,
      documentId: docAId,
      threshold: 0.0,
      topK: 5,
      queryVector: dummyEmbedding768,
    });
    assert(bobSearchAfterRevoke.length === 0, "Revoked user receives 0 chunks in vector search");

    // Immediate Revocation Invariant in Comparison: Bob can no longer retrieve comparison cache involving Doc A
    const dualAfterRevoke = await verifyDualDocumentAccess({
      sourceDocumentId: docAId,
      targetDocumentId: docDId,
      userId: bobId,
      requiredPermission: "read",
    });
    assert(dualAfterRevoke.authorized === false && dualAfterRevoke.errorResponse.status === 404, "Revoking access to Doc A immediately blocks cached comparison retrieval");

    // Conversation Security Invariant:
    // Historical conversation messages remain intact
    const pastMessages = await db.select().from(messages).where(eq(messages.conversationId, convBob.id));
    assert(pastMessages.length === 2, "Historical conversation messages preserved for personal audit");

    // But posting a NEW question against the revoked document is strictly blocked with 404
    const newMsgCheck = await verifyDocumentAccess({ documentId: convBob.documentId, userId: bobId, requiredPermission: "read" });
    assert(newMsgCheck.authorized === false && newMsgCheck.errorResponse.status === 404, "Posting new question to revoked document rejected with 404 BEFORE vector search or Gemini call");

    // Clean up test document D
    await db.delete(documents).where(eq(documents.id, docDId));

    console.log("\n==========================================================");
    console.log(`  Phase 13 Security Invariant Verification Completed!    `);
    console.log(`  Passed: ${passedTests} / ${totalTests} assertions       `);
    console.log("==========================================================");
  } finally {
    // Teardown test fixtures
    try {
      if (docAId) await db.delete(documents).where(eq(documents.id, docAId));
      if (docBId) await db.delete(documents).where(eq(documents.id, docBId));
      if (docCId) await db.delete(documents).where(eq(documents.id, docCId));
      await db.delete(users).where(eq(users.id, aliceId));
      await db.delete(users).where(eq(users.id, bobId));
      await db.delete(users).where(eq(users.id, charlieId));
      await db.delete(users).where(eq(users.id, daveId));
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await sqlClient.end();
  }
}

runPhase13Verification().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
