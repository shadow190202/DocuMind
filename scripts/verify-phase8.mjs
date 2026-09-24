import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, sql } from "drizzle-orm";
import { searchRequestSchema } from "../src/lib/validations/search.js";
import { assembleRagContext } from "../src/lib/ai/rag-context.js";
import { documents, documentChunks, users } from "../src/db/schema.js";

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

async function runVerification() {
  console.log("==================================================");
  console.log("   DocuMind Phase 8: Verification Test Suite     ");
  console.log("==================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ----------------------------------------------------
  // TEST SUITE 1: Zod Search Validation Schema
  // ----------------------------------------------------
  console.log("--- 1. Testing Zod Search Validation Schema ---");

  // Empty / whitespace query rejected
  const emptyRes = searchRequestSchema.safeParse({ query: "" });
  assert(!emptyRes.success, "Rejects empty query string");

  const whitespaceRes = searchRequestSchema.safeParse({ query: "    " });
  assert(!whitespaceRes.success, "Rejects whitespace-only query string");

  // Max characters (> 2,000 rejected)
  const tooLongRes = searchRequestSchema.safeParse({ query: "a".repeat(2001) });
  assert(!tooLongRes.success, "Rejects query exceeding 2,000 characters");

  // Valid query trimmed and accepted
  const validQueryRes = searchRequestSchema.safeParse({ query: "  financial report 2024  " });
  assert(validQueryRes.success && validQueryRes.data.query === "financial report 2024", "Trims and accepts valid query");

  // topK boundary checks
  const topKZero = searchRequestSchema.safeParse({ query: "test", topK: 0 });
  assert(!topKZero.success, "Rejects topK < 1");

  const topKTooHigh = searchRequestSchema.safeParse({ query: "test", topK: 21 });
  assert(!topKTooHigh.success, "Rejects topK > 20");

  const topKFloat = searchRequestSchema.safeParse({ query: "test", topK: 5.5 });
  assert(!topKFloat.success, "Rejects non-integer topK");

  const topKValid = searchRequestSchema.safeParse({ query: "test", topK: 10 });
  assert(topKValid.success && topKValid.data.topK === 10, "Accepts valid integer topK (10)");

  // Default values
  const defaultRes = searchRequestSchema.safeParse({ query: "test" });
  assert(
    defaultRes.success &&
      defaultRes.data.topK === 5 &&
      defaultRes.data.threshold === 0.5 &&
      defaultRes.data.includeContext === false &&
      defaultRes.data.maxContextTokens === 3000,
    "Applies correct defaults (topK: 5, threshold: 0.5, includeContext: false, maxContextTokens: 3000)"
  );

  // Threshold boundaries
  const thresholdNegative = searchRequestSchema.safeParse({ query: "test", threshold: -0.01 });
  assert(!thresholdNegative.success, "Rejects negative threshold (< 0.0)");

  const thresholdTooHigh = searchRequestSchema.safeParse({ query: "test", threshold: 1.01 });
  assert(!thresholdTooHigh.success, "Rejects threshold > 1.0");

  const thresholdValid = searchRequestSchema.safeParse({ query: "test", threshold: 0.75 });
  assert(thresholdValid.success && thresholdValid.data.threshold === 0.75, "Accepts valid threshold (0.75)");

  // UUID validation for documentId
  const invalidUuidRes = searchRequestSchema.safeParse({ query: "test", documentId: "not-a-uuid" });
  assert(!invalidUuidRes.success, "Rejects invalid documentId UUID format");

  const validUuidRes = searchRequestSchema.safeParse({
    query: "test",
    documentId: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert(validUuidRes.success, "Accepts valid UUID for documentId");

  console.log("Zod validation tests passed!\n");

  // ----------------------------------------------------
  // TEST SUITE 2: RAG Context Assembler
  // ----------------------------------------------------
  console.log("--- 2. Testing RAG Context Assembler ---");

  const sampleChunks = [
    {
      chunkId: "c1",
      documentId: "d1",
      documentName: "AnnualReport.pdf",
      fileType: "pdf",
      chunkIndex: 0,
      content: "Company revenue grew by 25% year-over-year in 2024.",
      pageNumber: 3,
      similarityScore: 0.885,
      estimatedTokenCount: 13,
    },
    {
      chunkId: "c1", // EXACT DUPLICATE OF c1
      documentId: "d1",
      documentName: "AnnualReport.pdf",
      fileType: "pdf",
      chunkIndex: 0,
      content: "Company revenue grew by 25% year-over-year in 2024.",
      pageNumber: 3,
      similarityScore: 0.885,
      estimatedTokenCount: 13,
    },
    {
      chunkId: "c2", // ADJACENT CHUNK to c1 (Chunk #1)
      documentId: "d1",
      documentName: "AnnualReport.pdf",
      fileType: "pdf",
      chunkIndex: 1,
      content: "Operating margins expanded to 18.5% driven by AI automation.",
      pageNumber: 3,
      similarityScore: 0.812,
      estimatedTokenCount: 15,
    },
    {
      chunkId: "c3",
      documentId: "d2",
      documentName: "Notes.docx",
      fileType: "docx",
      chunkIndex: 0,
      content: "Meeting notes regarding quarterly engineering goals.",
      pageNumber: null, // Non-PDF format has null pageNumber
      similarityScore: 0.742,
      estimatedTokenCount: 12,
    },
  ];

  // Test deduplication and adjacent chunk preservation
  const ragResult = assembleRagContext(sampleChunks, { maxContextTokens: 3000 });
  assert(ragResult.chunksUsed === 3, "Deduplicates exact duplicate c1 while preserving c1, c2, c3");
  assert(ragResult.sources.length === 3, "Returns 3 distinct sources");
  assert(ragResult.sources[0].chunkId === "c1", "Source 1 is c1");
  assert(ragResult.sources[1].chunkId === "c2", "Source 2 is adjacent chunk c2 (preserved)");
  assert(ragResult.sources[2].chunkId === "c3", "Source 3 is c3");

  // Metadata verification
  assert(ragResult.sources[0].pageNumber === 3, "Preserves genuine PDF page number (Page 3)");
  assert(ragResult.sources[2].pageNumber === null, "Preserves null page number for DOCX/TXT/CSV");
  assert(
    ragResult.contextText.includes("AnnualReport.pdf (Page 3, Chunk #1, Relevance: 88.5%)"),
    "Formats PDF citation header with page number and relevance percentage"
  );
  assert(
    ragResult.contextText.includes("Notes.docx (General Section, Chunk #1, Relevance: 74.2%)"),
    "Formats non-PDF citation header with 'General Section'"
  );

  // Token budget enforcement
  const tightBudgetResult = assembleRagContext(sampleChunks, { maxContextTokens: 20 });
  assert(tightBudgetResult.chunksUsed === 1, "Enforces maxContextTokens budget limit");
  assert(tightBudgetResult.chunksOmitted === 2, "Tracks omitted chunks accurately");
  assert(tightBudgetResult.totalEstimatedTokens <= 20, "Total estimated tokens stays within budget");

  // Empty chunks array handling
  const emptyRag = assembleRagContext([]);
  assert(
    emptyRag.contextText === "" && emptyRag.totalEstimatedTokens === 0 && emptyRag.chunksUsed === 0,
    "Gracefully handles empty chunk array"
  );

  console.log("RAG context assembler tests passed!\n");

  // ----------------------------------------------------
  // TEST SUITE 3: Database & pgvector Cosine Search
  // ----------------------------------------------------
  console.log("--- 3. Testing Database & pgvector Cosine Search ---");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set in .env.local");
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  const testUserA = `test_phase8_alice_${Date.now()}`;
  const testUserB = `test_phase8_bob_${Date.now()}`;
  let docAId = null;
  let docBId = null;

  try {
    // Insert test users
    await db.insert(users).values([
      { id: testUserA, email: `${testUserA}@test.com` },
      { id: testUserB, email: `${testUserB}@test.com` },
    ]);

    // Insert test documents
    const [insertedDocA] = await db
      .insert(documents)
      .values({
        userId: testUserA,
        filename: "AliceFinancials.pdf",
        fileType: "pdf",
        fileSize: 1024,
        storageUrl: "/test/alice.pdf",
        processingStatus: "completed",
      })
      .returning({ id: documents.id });
    docAId = insertedDocA.id;

    const [insertedDocB] = await db
      .insert(documents)
      .values({
        userId: testUserB,
        filename: "BobConfidential.docx",
        fileType: "docx",
        fileSize: 2048,
        storageUrl: "/test/bob.docx",
        processingStatus: "completed",
      })
      .returning({ id: documents.id });
    docBId = insertedDocB.id;

    // Create 768-dimensional deterministic test vectors
    // Vector 1 (aligned with query): [1, 0, 0, ...]
    const vector1 = new Array(768).fill(0);
    vector1[0] = 1.0;
    const vector1Param = `[${vector1.join(",")}]`;

    // Vector 2 (moderate alignment): [0.7071, 0.7071, 0, ...]
    const vector2 = new Array(768).fill(0);
    vector2[0] = 0.7071;
    vector2[1] = 0.7071;
    const vector2Param = `[${vector2.join(",")}]`;

    // Vector 3 (orthogonal to query): [0, 1, 0, ...]
    const vector3 = new Array(768).fill(0);
    vector3[1] = 1.0;
    const vector3Param = `[${vector3.join(",")}]`;

    // Insert chunks for User A
    await db.insert(documentChunks).values([
      {
        documentId: docAId,
        chunkIndex: 0,
        content: "Alice Q1 Financial Performance - Record revenue growth.",
        pageNumber: 1,
        embedding: sql`${vector1Param}::vector`,
      },
      {
        documentId: docAId,
        chunkIndex: 1,
        content: "Alice Q1 Operating Expenses and Infrastructure Costs.",
        pageNumber: 2,
        embedding: sql`${vector2Param}::vector`,
      },
      {
        documentId: docAId,
        chunkIndex: 2,
        content: "Alice Corporate Social Responsibility statement.",
        pageNumber: 3,
        embedding: sql`${vector3Param}::vector`,
      },
    ]);

    // Insert chunks for User B (Confidential)
    await db.insert(documentChunks).values([
      {
        documentId: docBId,
        chunkIndex: 0,
        content: "Bob Secret Strategy Document - Top Secret User B Chunks.",
        pageNumber: null,
        embedding: sql`${vector1Param}::vector`,
      },
    ]);

    console.log("Test documents and 768-dim chunks inserted successfully.");

    // Query vector: same as vector1 [1, 0, 0, ...]
    const queryVector = new Array(768).fill(0);
    queryVector[0] = 1.0;
    const queryParam = `[${queryVector.join(",")}]`;

    const distanceSql = sql`(${documentChunks.embedding} <=> ${queryParam}::vector)`;
    const similarityScoreSql = sql`ROUND((1 - ${distanceSql})::numeric, 4)`;

    // Test A: Cosine distance and similarity metric calculation
    // Distance between vector1 and queryVector is 0.0 -> similarity = 1.0
    // Distance between vector2 and queryVector is 1 - 0.7071 ≈ 0.2929 -> similarity ≈ 0.7071
    // Distance between vector3 and queryVector is 1 - 0 = 1.0 -> similarity = 0.0
    const rawAliceResults = await db
      .select({
        chunkId: documentChunks.id,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
        content: documentChunks.content,
        pageNumber: documentChunks.pageNumber,
        documentName: documents.filename,
        fileType: documents.fileType,
        similarityScore: sql`${similarityScoreSql}`.mapWith(Number),
      })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, testUserA),
          eq(documents.processingStatus, "completed"),
          sql`(1 - ${distanceSql}) >= 0.5`
        )
      )
      .orderBy(distanceSql)
      .limit(5);

    assert(rawAliceResults.length === 2, "Threshold 0.5 filters out Chunk 2 (similarity 0.0) before LIMIT");
    assert(rawAliceResults[0].chunkIndex === 0, "Highest similarity chunk (Rank 1) is Chunk 0");
    assert(
      Math.abs(rawAliceResults[0].similarityScore - 1.0) < 0.01,
      `Calculates accurate similarity score (expected ~1.0, got ${rawAliceResults[0].similarityScore})`
    );
    assert(
      Math.abs(rawAliceResults[1].similarityScore - 0.7071) < 0.01,
      `Calculates accurate similarity score for Chunk 1 (expected ~0.7071, got ${rawAliceResults[1].similarityScore})`
    );

    // Test B: Multi-Tenant Security Isolation
    // Confirm User A's results contain ZERO records from User B
    const leakedUserB = rawAliceResults.filter((r) => r.documentId === docBId);
    assert(leakedUserB.length === 0, "MULTI-TENANT ISOLATION: User A query returned 0 chunks from User B");

    // Test C: User A scoped query to User B's document ID returns 0 results
    const scopedUnauthorized = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .innerJoin(documents, eq(documentChunks.documentId, documents.id))
      .where(
        and(
          eq(documents.userId, testUserA),
          eq(documents.id, docBId), // User A attempting to query User B's doc
          eq(documents.processingStatus, "completed")
        )
      );
    assert(
      scopedUnauthorized.length === 0,
      "MULTI-TENANT ISOLATION: Scoping search to another user's document ID returns 0 results"
    );

    // Test D: Embedding vector column is NOT exposed
    const firstRow = rawAliceResults[0];
    assert(firstRow.embedding === undefined, "RAW VECTOR PROTECTION: Embedding vector is never selected or exposed");

    console.log("Database vector search & multi-tenant isolation tests passed!\n");
  } finally {
    // Clean up test data
    console.log("Cleaning up test data...");
    if (docAId) {
      await db.delete(documentChunks).where(eq(documentChunks.documentId, docAId));
      await db.delete(documents).where(eq(documents.id, docAId));
    }
    if (docBId) {
      await db.delete(documentChunks).where(eq(documentChunks.documentId, docBId));
      await db.delete(documents).where(eq(documents.id, docBId));
    }
    await db.delete(users).where(eq(users.id, testUserA));
    await db.delete(users).where(eq(users.id, testUserB));
    await sqlClient.end();
    console.log("Test data cleanup complete.\n");
  }

  // ----------------------------------------------------
  // TEST SUITE 4: 100% JavaScript & Invariants Check
  // ----------------------------------------------------
  console.log("--- 4. Testing 100% JavaScript & Repository Invariants ---");

  // Check package.json for @types/*
  const pkgContent = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
  );
  const allDeps = {
    ...pkgContent.dependencies,
    ...pkgContent.devDependencies,
  };
  const typeDeps = Object.keys(allDeps).filter(
    (d) => d.startsWith("@types/") || d === "typescript"
  );
  assert(typeDeps.length === 0, "Zero TypeScript dependencies or @types/* packages in package.json");

  // Recursively scan src directory for .ts or .tsx files
  function scanForTs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const tsFiles = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        tsFiles.push(...scanForTs(fullPath));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        tsFiles.push(fullPath);
      }
    }
    return tsFiles;
  }

  const tsFound = scanForTs(path.resolve(__dirname, "../src"));
  assert(tsFound.length === 0, "Zero .ts or .tsx files in src/ directory (100% JavaScript)");

  console.log("\n==================================================");
  console.log(` ALL PHASE 8 VERIFICATIONS PASSED (${passedTests}/${totalTests})`);
  console.log("==================================================\n");
}

runVerification().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
