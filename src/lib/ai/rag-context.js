/**
 * RAG Context Assembler
 *
 * Formats retrieved chunks into an LLM-ready context block.
 *
 * Invariants & Requirements:
 * 1. Preserves source citations: document name, file type, genuine PDF page numbers, chunk index.
 * 2. Truthful metadata: preserves null page numbers for non-physical formats (DOCX/TXT/CSV).
 * 3. Exact Duplicate Removal: Deduplicates exact chunk IDs.
 * 4. Adjacent Chunk Preservation: Distinct adjacent chunks are preserved for context continuity.
 * 5. Estimated Token Budgeting: Enforces configurable context budget (default: 3,000 estimated tokens).
 * 6. Explicit Labeling: Token counts are strictly labeled as estimatedTokenCount.
 * 7. Zero LLM Calls: Pure context assembly; does not invoke any generative AI models.
 */

const DEFAULT_MAX_CONTEXT_TOKENS = 3000;

/**
 * Assembles scored chunks into a clean, formatted RAG prompt context block.
 *
 * @param {Array<{
 *   chunkId: string,
 *   documentId: string,
 *   documentName: string,
 *   fileType: string,
 *   chunkIndex: number,
 *   content: string,
 *   pageNumber: number|null,
 *   similarityScore: number,
 *   estimatedTokenCount?: number
 * }>} chunks - Array of retrieved chunk objects
 * @param {Object} [options]
 * @param {number} [options.maxContextTokens=3000] - Budget limit in estimated tokens
 * @returns {{
 *   contextText: string,
 *   sources: Array<Object>,
 *   totalEstimatedTokens: number,
 *   chunksUsed: number,
 *   chunksOmitted: number
 * }}
 */
export function assembleRagContext(chunks, options = {}) {
  const maxContextTokens = options.maxContextTokens || DEFAULT_MAX_CONTEXT_TOKENS;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return {
      contextText: "",
      sources: [],
      totalEstimatedTokens: 0,
      chunksUsed: 0,
      chunksOmitted: 0,
    };
  }

  // 1. Remove exact duplicate chunk IDs while preserving distinct adjacent chunks
  const seenIds = new Set();
  const uniqueChunks = [];

  for (const chunk of chunks) {
    if (!chunk || !chunk.chunkId) continue;

    if (!seenIds.has(chunk.chunkId)) {
      seenIds.add(chunk.chunkId);
      // Distinct adjacent chunks (e.g. Chunk 10, Chunk 11, Chunk 12) have unique IDs and are preserved!
      uniqueChunks.push(chunk);
    }
  }

  // 2. Assemble context blocks within estimated token budget
  const contextBlocks = [];
  const sources = [];
  let totalEstimatedTokens = 0;
  let chunksUsed = 0;
  let chunksOmitted = 0;

  for (let i = 0; i < uniqueChunks.length; i++) {
    const chunk = uniqueChunks[i];
    const chunkTokens =
      chunk.estimatedTokenCount || Math.ceil((chunk.content?.length || 0) / 4);

    // If adding this chunk would exceed the token budget and we already have at least 1 chunk, stop
    if (chunksUsed > 0 && totalEstimatedTokens + chunkTokens > maxContextTokens) {
      chunksOmitted++;
      continue;
    }

    const sourceNumber = chunksUsed + 1;
    const pageLabel =
      chunk.pageNumber !== null && chunk.pageNumber !== undefined
        ? `Page ${chunk.pageNumber}`
        : "General Section";

    const relevancePct =
      typeof chunk.similarityScore === "number"
        ? `${(chunk.similarityScore * 100).toFixed(1)}%`
        : "N/A";

    const header = `--- [SOURCE ${sourceNumber}] ${chunk.documentName} (${pageLabel}, Chunk #${chunk.chunkIndex + 1}, Relevance: ${relevancePct}) ---`;
    const blockContent = `${header}\n${(chunk.content || "").trim()}`;

    contextBlocks.push(blockContent);
    sources.push({
      sourceNumber,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      fileType: chunk.fileType,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber, // genuine number for PDF, null for others
      similarityScore: chunk.similarityScore,
      estimatedTokenCount: chunkTokens,
    });

    totalEstimatedTokens += chunkTokens;
    chunksUsed++;
  }

  return {
    contextText: contextBlocks.join("\n\n"),
    sources,
    totalEstimatedTokens,
    chunksUsed,
    chunksOmitted,
  };
}
