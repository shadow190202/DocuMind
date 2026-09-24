import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateEmbedding, EXPECTED_DIMENSIONS } from "./gemini";

/**
 * Executes a parameterized pgvector semantic vector search across document chunks.
 *
 * Invariants & Guarantees:
 * 1. Strict Multi-Tenant Isolation: Every query enforces documents.userId = authenticatedUserId
 *    at the database query level. Client-supplied document IDs cannot bypass this.
 * 2. Fully Parameterized SQL: All parameters (query vector, userId, documentId, threshold, topK)
 *    are passed as bound parameters; never concatenated into raw SQL strings.
 * 3. Verified Embedding Dimension: Validates queryVector.length === 768 before DB querying.
 * 4. Cosine Similarity Metric: similarity = 1 - cosineDistance (mathematical range -1.0 to +1.0).
 * 5. Pre-Limit Filtering: Chunks with similarity < threshold are filtered before LIMIT topK.
 * 6. Zero Vector Leaks: Never selects or returns dc.embedding.
 *
 * @param {Object} params
 * @param {string} params.query - Search text query
 * @param {string} params.userId - Authenticated user ID (Clerk ID)
 * @param {string} [params.documentId] - Scoped search to a single document ID
 * @param {string[]} [params.documentIds] - Scoped search to a subset of document IDs
 * @param {number} [params.topK=5] - Number of top chunks to return (1-20)
 * @param {number} [params.threshold=0.5] - Configurable starting similarity threshold (0.0-1.0)
 * @returns {Promise<Array<{
 *   chunkId: string,
 *   documentId: string,
 *   chunkIndex: number,
 *   content: string,
 *   pageNumber: number|null,
 *   documentName: string,
 *   fileType: string,
 *   similarityScore: number,
 *   estimatedTokenCount: number
 * }>>}
 */
export async function searchDocumentChunks({
  query,
  userId,
  documentId,
  documentIds,
  topK = 5,
  threshold = 0.5,
}) {
  if (!userId || typeof userId !== "string") {
    throw new Error("Unauthorized: authenticated userId is required for vector search.");
  }

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    throw new Error("Search query cannot be empty or whitespace only.");
  }

  // 1. Generate query embedding using the Phase 7 Gemini client (gemini-embedding-001)
  const queryVector = await generateEmbedding(query.trim());

  // 2. Strict dimension validation before querying database
  if (!Array.isArray(queryVector) || queryVector.length !== EXPECTED_DIMENSIONS) {
    throw new Error(
      `Query embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, received ${queryVector?.length}.`
    );
  }

  // 3. Prepare parameterized vector string for pgvector casting ($N::vector)
  const vectorParam = `[${queryVector.join(",")}]`;

  // 4. Define parameterized cosine distance and similarity expressions
  // Distance: (embedding <=> $param::vector)
  // Similarity: 1 - distance
  const distanceSql = sql`(${documentChunks.embedding} <=> ${vectorParam}::vector)`;
  const similarityScoreSql = sql`ROUND((1 - ${distanceSql})::numeric, 4)`;

  // 5. Build parameterized query conditions with mandatory ownership isolation
  const conditions = [
    // Mandatory ownership filter: user can ONLY access their own documents
    eq(documents.userId, userId),
    // Only search completed documents
    eq(documents.processingStatus, "completed"),
    // Threshold filtering applied BEFORE LIMIT
    sql`(1 - ${distanceSql}) >= ${threshold}`,
  ];

  if (documentId) {
    conditions.push(eq(documents.id, documentId));
  } else if (Array.isArray(documentIds) && documentIds.length > 0) {
    conditions.push(inArray(documents.id, documentIds));
  }

  // 6. Execute search query
  // Explicitly NEVER selecting dc.embedding
  const rawResults = await db
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
    .where(and(...conditions))
    .orderBy(distanceSql)
    .limit(topK);

  // 7. Format results with estimated token counts
  return rawResults.map((row) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    chunkIndex: row.chunkIndex,
    content: row.content,
    pageNumber: row.pageNumber, // genuine physical page number for PDF, null for others
    documentName: row.documentName,
    fileType: row.fileType,
    similarityScore: row.similarityScore,
    estimatedTokenCount: Math.ceil((row.content?.length || 0) / 4),
  }));
}
