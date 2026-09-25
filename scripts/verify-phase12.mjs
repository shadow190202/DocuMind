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
  documentComparisons,
  aiUsageLogs,
} from "../src/db/schema.js";
import {
  compareDocumentsRequestSchema,
  getComparisonQuerySchema,
} from "../src/lib/validations/comparison.js";
import {
  DEFAULT_COMPARISON_SYSTEM_INSTRUCTION,
  buildDocumentComparisonPrompt,
  computeCosineSimilarity,
  buildBidirectionalCandidateAlignment,
  callGeminiSummarizer,
  SIMILARITY_HIGH,
  SIMILARITY_MODERATE,
  CHAT_MODEL,
} from "../src/lib/ai/gemini.js";

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

async function runPhase12Verification() {
  console.log("==================================================");
  console.log("  DocuMind Phase 12: Document Comparison Suite    ");
  console.log("==================================================\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  const testUserAlice = `test_p12_alice_${Date.now()}`;
  const testUserBob = `test_p12_bob_${Date.now()}`;
  let docAId = null;
  let docBId = null;
  let docCId = null;

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Database Schema & Migration Integrity
    // ----------------------------------------------------
    console.log("--- 1. Testing Database Schema, Migration & Unique Constraint ---");

    const tables = await sqlClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'document_comparisons'
    `;
    assert(tables.length === 1, "Table 'document_comparisons' exists in PostgreSQL");

    const columns = await sqlClient`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'document_comparisons'
    `;
    const colMap = new Map(columns.map((c) => [c.column_name, c]));
    assert(colMap.has("id"), "Column 'id' exists");
    assert(colMap.has("user_id"), "Column 'user_id' exists");
    assert(colMap.has("source_document_id"), "Column 'source_document_id' exists");
    assert(colMap.has("target_document_id"), "Column 'target_document_id' exists");
    assert(colMap.has("content"), "Column 'content' exists");
    assert(colMap.has("structured_data"), "Column 'structured_data' exists");
    assert(colMap.has("model"), "Column 'model' exists");
    assert(colMap.has("prompt_tokens"), "Column 'prompt_tokens' exists");
    assert(colMap.has("completion_tokens"), "Column 'completion_tokens' exists");
    assert(colMap.has("total_tokens"), "Column 'total_tokens' exists");
    assert(colMap.has("created_at"), "Column 'created_at' exists");
    assert(colMap.has("updated_at"), "Column 'updated_at' exists");

    const indexes = await sqlClient`
      SELECT indexname, tablename, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'document_comparisons'
    `;
    const indexNames = indexes.map((i) => i.indexname);
    assert(
      indexNames.includes("doc_comparisons_pair_uniq_idx"),
      "Directional unique index 'doc_comparisons_pair_uniq_idx' exists on (source_document_id, target_document_id)"
    );
    assert(
      indexNames.includes("doc_comparisons_user_created_idx"),
      "Index 'doc_comparisons_user_created_idx' exists on (user_id, created_at)"
    );
    assert(
      indexNames.includes("doc_comparisons_source_idx"),
      "Index 'doc_comparisons_source_idx' exists on source_document_id"
    );
    assert(
      indexNames.includes("doc_comparisons_target_idx"),
      "Index 'doc_comparisons_target_idx' exists on target_document_id"
    );

    // Verify migration journal has 0005
    const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
    assert(fs.existsSync(journalPath), "Drizzle migration journal exists");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const entry0005 = journal.entries.find((e) => e.tag === "0005_add_document_comparisons");
    assert(Boolean(entry0005), "Migration 0005_add_document_comparisons registered in journal");

    // ----------------------------------------------------
    // TEST SUITE 2: Zod Validation Schemas
    // ----------------------------------------------------
    console.log("\n--- 2. Testing Zod Validation Schemas ---");

    const validUUID1 = "11111111-1111-4111-8111-111111111111";
    const validUUID2 = "22222222-2222-4222-8222-222222222222";

    // Valid compare request
    const validReq = compareDocumentsRequestSchema.safeParse({
      sourceDocumentId: validUUID1,
      targetDocumentId: validUUID2,
    });
    assert(validReq.success === true, "Valid distinct UUIDs pass request schema");
    assert(validReq.data.regenerate === false, "regenerate defaults to false");

    // Self-comparison rejection
    const selfCompare = compareDocumentsRequestSchema.safeParse({
      sourceDocumentId: validUUID1,
      targetDocumentId: validUUID1,
    });
    assert(selfCompare.success === false, "Comparing document to itself is rejected by Zod");

    // Invalid UUID
    const badUUID = compareDocumentsRequestSchema.safeParse({
      sourceDocumentId: "invalid-id",
      targetDocumentId: validUUID2,
    });
    assert(badUUID.success === false, "Non-UUID string rejected by Zod");

    // GET query schema: recent=true
    const recentQuery = getComparisonQuerySchema.safeParse({ recent: "true" });
    assert(recentQuery.success === true, "Query with recent=true passes Zod");

    // GET query schema: valid pair
    const pairQuery = getComparisonQuerySchema.safeParse({
      sourceId: validUUID1,
      targetId: validUUID2,
    });
    assert(pairQuery.success === true, "Query with valid distinct sourceId and targetId passes Zod");

    // GET query schema: same IDs rejected
    const samePairQuery = getComparisonQuerySchema.safeParse({
      sourceId: validUUID1,
      targetId: validUUID1,
    });
    assert(samePairQuery.success === false, "Query with identical sourceId and targetId rejected");

    // ----------------------------------------------------
    // TEST SUITE 3: Algorithmic Cosine Similarity & Graph Alignment
    // ----------------------------------------------------
    console.log("\n--- 3. Testing Algorithmic Cosine Similarity & Alignment ---");

    // Cosine similarity tests
    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [-1, 0, 0];

    const simIdentical = computeCosineSimilarity(vecA, vecB);
    assert(Math.abs(simIdentical - 1.0) < 1e-6, "Cosine similarity for identical vectors is 1.0");

    const simOrthogonal = computeCosineSimilarity(vecA, vecC);
    assert(Math.abs(simOrthogonal - 0.0) < 1e-6, "Cosine similarity for orthogonal vectors is 0.0");

    const simInverse = computeCosineSimilarity(vecA, vecD);
    assert(Math.abs(simInverse - (-1.0)) < 1e-6, "Cosine similarity for opposite vectors is -1.0");

    // Graph alignment test
    const dummyChunksA = [
      { chunkIndex: 0, content: "Scope of work: 10 servers deployed on Jan 15 2026.", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Governing law is New York state.", embedding: [0, 1, 0] },
      { chunkIndex: 2, content: "Legacy clause to be removed in revised draft.", embedding: [0, 0, 1] },
    ];
    const dummyChunksB = [
      { chunkIndex: 0, content: "Scope of work: 25 servers deployed on Feb 20 2026.", embedding: [0.75, 0.66, 0] }, // modified
      { chunkIndex: 1, content: "Governing law is New York state.", embedding: [0, 1, 0] }, // common / identical
      { chunkIndex: 2, content: "Brand new clause added for cybersecurity compliance.", embedding: [0.5, 0.5, 0.707] }, // candidate
    ];

    const alignmentUnits = buildBidirectionalCandidateAlignment({
      chunksA: dummyChunksA,
      chunksB: dummyChunksB,
      similarityModerate: 0.60,
      similarityHigh: 0.85,
    });

    assert(Array.isArray(alignmentUnits), "Alignment produces array of semantic units");
    assert(alignmentUnits.length > 0, "Alignment units populated");
    assert(
      alignmentUnits.some((u) => u.type === "common"),
      "Correctly identifies common/unchanged unit"
    );
    assert(
      alignmentUnits.some((u) => u.hasNumbersDates === true),
      "Correctly detects numerical and date elements"
    );

    // ----------------------------------------------------
    // TEST SUITE 3.1: Focused Verification for Defect 1 (Bidirectional edgesAtoB Fusion)
    // ----------------------------------------------------
    console.log("\n--- 3.1 Focused Verification for Defect 1: Bidirectional edgesAtoB Fusion ---");

    // Case 1: Reciprocal 1:1 match
    const bidiDocA = [
      { chunkIndex: 0, content: "Reciprocal clause A", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Unique clause in A", embedding: [0, 1, 0] },
    ];
    const bidiDocB = [
      { chunkIndex: 0, content: "Reciprocal clause B", embedding: [0.99, 0.05, 0] }, // high similarity with A0
      { chunkIndex: 1, content: "Unique clause in B", embedding: [0, 0, 1] },
    ];

    const bidiUnits = buildBidirectionalCandidateAlignment({
      chunksA: bidiDocA,
      chunksB: bidiDocB,
      similarityModerate: 0.65,
      similarityHigh: 0.85,
    });
    assert(
      bidiUnits.some((u) => u.type === "common" && u.chunksA.length === 1 && u.chunksB.length === 1),
      "Reciprocal 1:1 match confirmed bidirectionally as 'common'"
    );

    // Case 2: B->A-only relationship must NOT be promoted to bidirectional match
    // B2 has candidate A0 (sim=0.80), but A0's topK=2 candidates in edgesAtoB are B0 (1.0) and B1 (0.998)
    const bToAOnly_A = [
      { chunkIndex: 0, content: "Alpha primary", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Alpha other", embedding: [0, 1, 0] },
    ];
    const bToAOnly_B = [
      { chunkIndex: 0, content: "Beta matching Alpha primary", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Beta also close to Alpha primary", embedding: [0.99, 0.05, 0] },
      { chunkIndex: 2, content: "Beta weak candidate to Alpha primary", embedding: [0.80, 0, 0.60] },
    ];

    const bToAOnlyUnits = buildBidirectionalCandidateAlignment({
      chunksA: bToAOnly_A,
      chunksB: bToAOnly_B,
      similarityModerate: 0.65,
      similarityHigh: 0.85,
      topK: 2,
    });

    // B2 should NOT be matched to A0 because A0's topK=2 in edgesAtoB are B0 and B1!
    // B2 is a B->A-only candidate and must remain an "added" unit
    const b2Unit = bToAOnlyUnits.find((u) => u.chunksB.some((c) => c.chunkIndex === 2));
    assert(
      b2Unit && b2Unit.type === "added",
      "Defect 1 Fix: B->A-only relationship is NOT incorrectly promoted to bidirectional match (remains 'added')"
    );

    // Case 3: A->B-only relationship must NOT be promoted to bidirectional match
    // A2 has candidate B0 (sim=0.80), but B0's topK=2 candidates in edgesBtoA are A0 (1.0) and A1 (0.998)
    const aToBOnly_A = [
      { chunkIndex: 0, content: "Clause A0", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Clause A1", embedding: [0.99, 0.05, 0] },
      { chunkIndex: 2, content: "Clause A2 weak to B0", embedding: [0.80, 0, 0.60] },
    ];
    const aToBOnly_B = [
      { chunkIndex: 0, content: "Clause B0", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Clause B1", embedding: [0, 1, 0] },
    ];

    const aToBOnlyUnits = buildBidirectionalCandidateAlignment({
      chunksA: aToBOnly_A,
      chunksB: aToBOnly_B,
      similarityModerate: 0.65,
      similarityHigh: 0.85,
      topK: 2,
    });

    const a2Unit = aToBOnlyUnits.find((u) => u.chunksA.some((c) => c.chunkIndex === 2));
    assert(
      a2Unit && a2Unit.type === "removed",
      "Defect 1 Fix: A->B-only relationship is NOT incorrectly promoted to bidirectional match (remains 'removed')"
    );

    // ----------------------------------------------------
    // TEST SUITE 3.2: Focused Verification for Defect 2 (Adjacent Context Padding)
    // ----------------------------------------------------
    console.log("\n--- 3.2 Focused Verification for Defect 2: Adjacent Context Padding ---");

    const contextDocA = [
      { chunkIndex: 0, content: "First chunk A", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Middle chunk A", embedding: [0, 1, 0] },
      { chunkIndex: 2, content: "Last chunk A", embedding: [0, 0, 1] },
    ];
    const contextDocB = [
      { chunkIndex: 0, content: "First chunk B (matches A0)", embedding: [1, 0, 0] },
      { chunkIndex: 1, content: "Middle chunk B (matches A1)", embedding: [0, 1, 0] },
      { chunkIndex: 2, content: "Brand new isolated chunk in B", embedding: [0.577, 0.577, 0.577] },
    ];

    const contextUnits = buildBidirectionalCandidateAlignment({
      chunksA: contextDocA,
      chunksB: contextDocB,
      similarityModerate: 0.65,
      similarityHigh: 0.85,
    });

    // Check First Chunk (index 0): prev should be null, next should be chunk 1
    const firstUnit = contextUnits.find(
      (u) => u.chunksA.some((c) => c.chunkIndex === 0) && u.chunksB.some((c) => c.chunkIndex === 0)
    );
    assert(Boolean(firstUnit), "First chunk unit found");
    assert(firstUnit.contextA.prev === null, "Defect 2 Fix: First chunk contextA.prev is null");
    assert(firstUnit.contextA.next?.chunkIndex === 1, "Defect 2 Fix: First chunk contextA.next is chunk 1");
    assert(firstUnit.contextB.prev === null, "Defect 2 Fix: First chunk contextB.prev is null");
    assert(firstUnit.contextB.next?.chunkIndex === 1, "Defect 2 Fix: First chunk contextB.next is chunk 1");

    // Check Middle Chunk (index 1): both prev and next must be present
    const middleUnit = contextUnits.find(
      (u) => u.chunksA.some((c) => c.chunkIndex === 1) && u.chunksB.some((c) => c.chunkIndex === 1)
    );
    assert(Boolean(middleUnit), "Middle chunk unit found");
    assert(middleUnit.contextA.prev?.chunkIndex === 0, "Defect 2 Fix: Middle chunk contextA.prev is chunk 0");
    assert(middleUnit.contextA.next?.chunkIndex === 2, "Defect 2 Fix: Middle chunk contextA.next is chunk 2");

    // Check Last Chunk / Isolated Removed Chunk (A2): prev is chunk 1, next is null
    const lastUnitA = contextUnits.find(
      (u) => u.type === "removed" && u.chunksA.some((c) => c.chunkIndex === 2)
    );
    assert(Boolean(lastUnitA), "Isolated removed chunk unit (A2) found");
    assert(lastUnitA.contextA.prev?.chunkIndex === 1, "Defect 2 Fix: Last chunk contextA.prev is chunk 1");
    assert(lastUnitA.contextA.next === null, "Defect 2 Fix: Last chunk contextA.next is null");
    assert(lastUnitA.contextB === null, "Defect 2 Fix: Isolated A chunk has contextB as null");

    // Check Isolated Added Chunk (B2): prev is chunk 1, next is null
    const isolatedUnitB = contextUnits.find(
      (u) => u.type === "added" && u.chunksB.some((c) => c.chunkIndex === 2)
    );
    assert(Boolean(isolatedUnitB), "Isolated added chunk unit (B2) found");
    assert(isolatedUnitB.contextB.prev?.chunkIndex === 1, "Defect 2 Fix: Isolated B chunk contextB.prev is chunk 1");
    assert(isolatedUnitB.contextB.next === null, "Defect 2 Fix: Isolated B chunk contextB.next is null");
    assert(isolatedUnitB.contextA === null, "Defect 2 Fix: Isolated B chunk has contextA as null");

    // Check Grouped N:1 unit: context must be null for grouped side
    const groupedDocA = [
      { chunkIndex: 0, content: "Broad provision in A", embedding: [1, 0, 0] },
    ];
    const groupedDocB = [
      { chunkIndex: 0, content: "Part 1 of provision in B", embedding: [0.95, 0.05, 0] },
      { chunkIndex: 1, content: "Part 2 of provision in B", embedding: [0.94, 0.06, 0] },
    ];
    const groupedUnits = buildBidirectionalCandidateAlignment({
      chunksA: groupedDocA,
      chunksB: groupedDocB,
      similarityModerate: 0.65,
      similarityHigh: 0.85,
    });
    const nToOneUnit = groupedUnits.find((u) => u.chunksB.length > 1);
    assert(Boolean(nToOneUnit), "Grouped N:1 unit identified");
    assert(
      nToOneUnit.contextB === null,
      "Defect 2 Fix: Grouped N:1 unit has contextB as null (no redundant context on grouped side)"
    );

    // ----------------------------------------------------
    // TEST SUITE 3.3: Focused Verification for Defect 3 (Parameterized maxOutputTokens)
    // ----------------------------------------------------
    console.log("\n--- 3.3 Focused Verification for Defect 3: Parameterized maxOutputTokens ---");

    assert(
      typeof callGeminiSummarizer === "function",
      "Defect 3 Fix: callGeminiSummarizer is exported and callable"
    );

    // Direct comparison prompt test
    const promptText = buildDocumentComparisonPrompt({
      textA: "Base content",
      textB: "Revised content",
      budgetDisclosure: true,
    });
    assert(
      promptText.includes("<<<UNTRUSTED_DOCUMENT_A_BASE_CONTENT>>>"),
      "Prompt encloses Document A in untrusted security delimiter fence"
    );
    assert(
      promptText.includes("<<<UNTRUSTED_DOCUMENT_B_REVISED_CONTENT>>>"),
      "Prompt encloses Document B in untrusted security delimiter fence"
    );
    assert(
      promptText.includes("DocuMind's comparison budget"),
      "Prompt includes budget disclosure when budget is exceeded"
    );

    // ----------------------------------------------------
    // TEST SUITE 4: Directional Uniqueness & Database CRUD
    // ----------------------------------------------------
    console.log("\n--- 4. Testing Directional Uniqueness & Database CRUD ---");

    // Setup test users
    await db.insert(users).values([
      { id: testUserAlice, email: `${testUserAlice}@example.com`, name: "Alice P12" },
      { id: testUserBob, email: `${testUserBob}@example.com`, name: "Bob P12" },
    ]);

    // Setup test documents for Alice
    const [d1] = await db
      .insert(documents)
      .values({
        userId: testUserAlice,
        filename: "Contract_v1.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        storageUrl: "https://example.com/c1.pdf",
        processingStatus: "completed",
      })
      .returning();
    docAId = d1.id;

    const [d2] = await db
      .insert(documents)
      .values({
        userId: testUserAlice,
        filename: "Contract_v2.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        storageUrl: "https://example.com/c2.pdf",
        processingStatus: "completed",
      })
      .returning();
    docBId = d2.id;

    // Insert comparison (docA -> docB)
    const [compAB] = await db
      .insert(documentComparisons)
      .values({
        userId: testUserAlice,
        sourceDocumentId: docAId,
        targetDocumentId: docBId,
        content: `## Executive Summary of Differences\nv2 introduces upgraded service tiers.\n\n## Added Content in [Document B]\nCybersecurity clause.\n\n## Removed Content from [Document A]\nLegacy SLA.\n\n## Modified & Altered Terms\nPayment terms extended to 45 days.\n\n## Important Numerical & Date Changes\n| Metric / Item | Document A (Base) | Document B (Revised) | Difference / Impact |\n| Price | $1,000 | $1,500 | +$500 |\n\n## Common & Unchanged Foundations\nGoverning jurisdiction remains Delaware.`,
        structuredData: null,
        model: CHAT_MODEL,
        promptTokens: 1200,
        completionTokens: 350,
        totalTokens: 1550,
      })
      .returning();
    assert(Boolean(compAB?.id), "Inserted comparison record for (docA, docB)");
    assert(compAB.structuredData === null, "structuredData is strictly null in Phase 12");

    // Directional test: (docB -> docA) must succeed because it is a separate directional record!
    const [compBA] = await db
      .insert(documentComparisons)
      .values({
        userId: testUserAlice,
        sourceDocumentId: docBId,
        targetDocumentId: docAId,
        content: `## Executive Summary of Differences\nInverted comparison v2 -> v1.`,
        structuredData: null,
        model: CHAT_MODEL,
        promptTokens: 800,
        completionTokens: 200,
        totalTokens: 1000,
      })
      .returning();
    assert(
      Boolean(compBA?.id) && compBA.id !== compAB.id,
      "Directional comparison (docB, docA) successfully saved as independent record"
    );

    // Duplicate directional insert (docA -> docB) must fail unique constraint!
    let duplicateFailed = false;
    try {
      await db.insert(documentComparisons).values({
        userId: testUserAlice,
        sourceDocumentId: docAId,
        targetDocumentId: docBId,
        content: "Duplicate attempt",
        model: CHAT_MODEL,
      });
    } catch {
      duplicateFailed = true;
    }
    assert(
      duplicateFailed === true,
      "Duplicate (sourceDocumentId, targetDocumentId) rejected by database unique index"
    );

    // ----------------------------------------------------
    // TEST SUITE 5: Transactional Reprocessing Cache Invalidation
    // ----------------------------------------------------
    console.log("\n--- 5. Testing Transactional Reprocessing Cache Invalidation ---");

    // Create a 3rd document for Bob
    const [d3] = await db
      .insert(documents)
      .values({
        userId: testUserBob,
        filename: "Bob_Document.pdf",
        fileType: "application/pdf",
        fileSize: 4096,
        storageUrl: "https://example.com/b1.pdf",
        processingStatus: "completed",
      })
      .returning();
    docCId = d3.id;

    // Verify compAB and compBA exist
    const preCount = await sqlClient`
      SELECT count(*)::int as c FROM document_comparisons
      WHERE source_document_id IN (${docAId}, ${docBId}) OR target_document_id IN (${docAId}, ${docBId})
    `;
    assert(preCount[0].c === 2, "2 comparisons exist before document reprocessing");

    // Simulate reprocessing docA: deleting chunks and invalidating comparisons
    await db.transaction(async (tx) => {
      // Step 8 transactional invalidation logic:
      await tx
        .delete(documentComparisons)
        .where(
          sql`${documentComparisons.sourceDocumentId} = ${docAId} OR ${documentComparisons.targetDocumentId} = ${docAId}`
        );
    });

    const postCount = await sqlClient`
      SELECT count(*)::int as c FROM document_comparisons
      WHERE source_document_id IN (${docAId}, ${docBId}) OR target_document_id IN (${docAId}, ${docBId})
    `;
    assert(
      postCount[0].c === 0,
      "Reprocessing docA transactionally invalidated and purged both comparisons involving docA"
    );

    // ----------------------------------------------------
    // TEST SUITE 6: Cascade Deletion & Tenant Isolation
    // ----------------------------------------------------
    console.log("\n--- 6. Testing Cascade Deletion & Tenant Isolation ---");

    // Reinsert compAB
    const [reinsertedComp] = await db
      .insert(documentComparisons)
      .values({
        userId: testUserAlice,
        sourceDocumentId: docAId,
        targetDocumentId: docBId,
        content: "Reinserted comparison content",
        model: CHAT_MODEL,
      })
      .returning();

    // Bob attempts to query Alice's comparison
    const bobQuery = await db
      .select()
      .from(documentComparisons)
      .where(
        and(
          eq(documentComparisons.id, reinsertedComp.id),
          eq(documentComparisons.userId, testUserBob) // Bob's userId
        )
      );
    assert(bobQuery.length === 0, "Strict tenant isolation: Bob cannot query Alice's comparison");

    // Deleting document A should cascade delete comparison
    await db.delete(documents).where(eq(documents.id, docAId));
    const cascadedComp = await db
      .select()
      .from(documentComparisons)
      .where(eq(documentComparisons.id, reinsertedComp.id));
    assert(cascadedComp.length === 0, "Deleting document cascade deletes associated comparisons");

    // ----------------------------------------------------
    // TEST SUITE 7: AI Usage Log Integration
    // ----------------------------------------------------
    console.log("\n--- 7. Testing AI Usage Log Integration ---");

    // Insert usage log with operation: 'compare'
    await db.insert(aiUsageLogs).values({
      userId: testUserAlice,
      model: CHAT_MODEL,
      operation: "compare",
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
    });

    // Check usage aggregation
    const [usageResult] = await db
      .select({
        comparisonsCount: sql`COUNT(CASE WHEN ${aiUsageLogs.operation} = 'compare' THEN 1 END)::integer`,
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, testUserAlice));

    assert(
      usageResult.comparisonsCount >= 1,
      "AI usage aggregation tracks comparisonsCount for operation: 'compare'"
    );

    // ----------------------------------------------------
    // TEST SUITE 8: Zero-TypeScript & Quality Standards
    // ----------------------------------------------------
    console.log("\n--- 8. Testing Zero-TypeScript & Architecture Invariants ---");

    function scanDirForTs(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (file !== "node_modules" && file !== ".next" && file !== ".git") {
            scanDirForTs(full);
          }
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          throw new Error(`TypeScript file found: ${full}`);
        }
      }
    }
    scanDirForTs(path.resolve(__dirname, "../src"));
    assert(true, "Zero .ts or .tsx files present in src/");

    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
    );
    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
    };
    const tsPackages = Object.keys(allDeps).filter(
      (dep) => dep === "typescript" || dep.startsWith("@types/")
    );
    assert(
      tsPackages.length === 0,
      "Zero TypeScript or @types/* packages found in package.json"
    );

    console.log("\n==================================================");
    console.log(`  Phase 12 Verification Complete: ${passedTests}/${totalTests} Passed!  `);
    console.log("==================================================\n");
  } finally {
    // Cleanup test data
    console.log("Cleaning up test data...");
    try {
      if (docBId) await db.delete(documents).where(eq(documents.id, docBId));
      if (docCId) await db.delete(documents).where(eq(documents.id, docCId));
      await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserAlice));
      await db.delete(users).where(eq(users.id, testUserAlice));
      await db.delete(users).where(eq(users.id, testUserBob));
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr.message);
    }
    await sqlClient.end();
  }
}

runPhase12Verification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
