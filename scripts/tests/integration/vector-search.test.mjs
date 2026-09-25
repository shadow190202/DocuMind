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
  EXPECTED_DIMENSIONS,
  createAxisUnitVector,
  createIntermediateVector,
  createOppositeVector,
  computeMathematicalCosineSimilarity,
} from "../utils/mock-ai.js";
import { users, documents, documentChunks } from "../../../src/db/schema.js";

export async function run() {
  console.log("\n--- Integration Tests: Controlled Vector Similarity Search ---");
  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  const db = getTestDb();
  const testRunId = createTestRunId("vector_int");
  const testUserId = `${testRunId}_searcher`;
  const docId = crypto.randomUUID();

  let passed = 0;

  try {
    // 1. Create test user and parent document
    await createTestUser(db, {
      id: testUserId,
      email: `${testUserId}@documind.test`,
      name: "Vector Tester",
      role: "user",
    });

    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: "vector-evaluation.txt",
      fileType: "txt",
      fileSize: 1024,
      storageUrl: "local://documents/test/vector.txt",
      processingStatus: "completed",
    });

    // 2. Synthesize 4 controlled 768-dimensional float vectors:
    // - Base query vector: Axis 0 unit vector [1, 0, 0, ...]
    // - Identical chunk: Axis 0 unit vector -> Cosine similarity = 1.0 (distance = 0.0)
    // - Intermediate chunk: Angle PI/4 -> Cosine similarity = cos(PI/4) ≈ 0.7071 (distance ≈ 0.2929)
    // - Orthogonal chunk: Axis 1 unit vector -> Cosine similarity = 0.0 (distance = 1.0)
    // - Opposite chunk: Negative Axis 0 -> Cosine similarity = -1.0 (distance = 2.0)
    const queryVector = createAxisUnitVector(EXPECTED_DIMENSIONS, 0);
    const identicalVector = createAxisUnitVector(EXPECTED_DIMENSIONS, 0);
    const intermediateVector = createIntermediateVector(EXPECTED_DIMENSIONS, 0, 1, Math.PI / 4);
    const orthogonalVector = createAxisUnitVector(EXPECTED_DIMENSIONS, 1);
    const oppositeVector = createOppositeVector(queryVector);

    // Verify mathematical cosine similarities before inserting into database
    assert.strictEqual(computeMathematicalCosineSimilarity(queryVector, identicalVector), 1.0);
    assert(Math.abs(computeMathematicalCosineSimilarity(queryVector, intermediateVector) - 0.707106) < 1e-4);
    assert.strictEqual(computeMathematicalCosineSimilarity(queryVector, orthogonalVector), 0.0);
    assert.strictEqual(computeMathematicalCosineSimilarity(queryVector, oppositeVector), -1.0);
    console.log("  ✅ Offline mathematical vectors conform to exact cosine boundaries (1.0, 0.7071, 0.0, -1.0)");
    passed++;

    // 3. Insert chunks into PostgreSQL document_chunks
    const chunkIdenticalId = crypto.randomUUID();
    const chunkIntermediateId = crypto.randomUUID();
    const chunkOrthogonalId = crypto.randomUUID();
    const chunkOppositeId = crypto.randomUUID();

    await db.insert(documentChunks).values([
      {
        id: chunkIdenticalId,
        documentId: docId,
        chunkIndex: 0,
        content: "Identical semantic representation chunk",
        characterCount: 38,
        estimatedTokenCount: 10,
        embedding: identicalVector,
      },
      {
        id: chunkIntermediateId,
        documentId: docId,
        chunkIndex: 1,
        content: "Intermediate semantic representation chunk at 45 degrees",
        characterCount: 56,
        estimatedTokenCount: 14,
        embedding: intermediateVector,
      },
      {
        id: chunkOrthogonalId,
        documentId: docId,
        chunkIndex: 2,
        content: "Orthogonal semantic representation chunk",
        characterCount: 39,
        estimatedTokenCount: 10,
        embedding: orthogonalVector,
      },
      {
        id: chunkOppositeId,
        documentId: docId,
        chunkIndex: 3,
        content: "Opposite semantic representation chunk",
        characterCount: 37,
        estimatedTokenCount: 10,
        embedding: oppositeVector,
      },
    ]);
    console.log("  ✅ Controlled 768-dim embeddings successfully stored in pgvector columns");
    passed++;

    // 4. Query pgvector using cosine distance operator (<=>)
    const formattedQueryVector = `[${queryVector.join(",")}]`;
    const searchResults = await db.execute(sql`
      SELECT 
        id,
        chunk_index,
        content,
        (embedding <=> ${formattedQueryVector}::vector) AS distance,
        (1 - (embedding <=> ${formattedQueryVector}::vector)) AS similarity
      FROM document_chunks
      WHERE document_id = ${docId}
      ORDER BY embedding <=> ${formattedQueryVector}::vector ASC;
    `);

    const rows = Array.isArray(searchResults) ? searchResults : searchResults.rows || [];
    assert.strictEqual(rows.length, 4);

    // 5. Assert strict monotonic ordering
    assert.strictEqual(rows[0].id, chunkIdenticalId, "First result must be the identical chunk");
    assert.strictEqual(rows[1].id, chunkIntermediateId, "Second result must be intermediate chunk");
    assert.strictEqual(rows[2].id, chunkOrthogonalId, "Third result must be orthogonal chunk");
    assert.strictEqual(rows[3].id, chunkOppositeId, "Fourth result must be opposite chunk");
    console.log("  ✅ pgvector cosine distance operator sorts chunks in strict monotonic semantic order");
    passed++;

    // 6. Assert numerical values match mathematical cosine expectation
    const sim0 = parseFloat(rows[0].similarity);
    const sim1 = parseFloat(rows[1].similarity);
    const sim2 = parseFloat(rows[2].similarity);
    const sim3 = parseFloat(rows[3].similarity);

    assert(Math.abs(sim0 - 1.0) < 1e-3, `Expected similarity ~1.0, got ${sim0}`);
    assert(Math.abs(sim1 - 0.7071) < 1e-3, `Expected similarity ~0.7071, got ${sim1}`);
    assert(Math.abs(sim2 - 0.0) < 1e-3, `Expected similarity ~0.0, got ${sim2}`);
    assert(Math.abs(sim3 - (-1.0)) < 1e-3, `Expected similarity ~-1.0, got ${sim3}`);
    console.log("  ✅ pgvector calculated similarities match mathematical theory within epsilon tolerance");
    passed++;
  } finally {
    await cleanupTestRunFixtures(db, testRunId);
  }

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("vector-search.test.mjs")) {
  run().then((r) => {
    console.log(`\nVector search integration tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Vector search integration tests failed:", err);
    process.exit(1);
  });
}
