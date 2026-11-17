import {
  getGenAIClient,
  executeWithRetry,
  EMBEDDING_MODEL,
  EXPECTED_DIMENSIONS,
  DEFAULT_EMBEDDING_BATCH_SIZE,
} from "./gemini.js";

/**
 * Generates an embedding for a single text chunk with strict 768-dimension validation.
 *
 * @param {string} text - Clean chunk text
 * @returns {Promise<number[]>} - Array of exactly 768 float values
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Cannot generate embedding for empty text content.");
  }

  const ai = getGenAIClient();
  return await executeWithRetry("generateEmbedding", async () => {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: {
        outputDimensionality: EXPECTED_DIMENSIONS,
      },
    });

    const embeddingValues = response?.embeddings?.[0]?.values;

    if (!Array.isArray(embeddingValues)) {
      throw new Error("Invalid response format from Gemini API: missing embedding values.");
    }

    if (embeddingValues.length !== EXPECTED_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EXPECTED_DIMENSIONS}, got ${embeddingValues.length} from model ${EMBEDDING_MODEL}.`
      );
    }

    return embeddingValues;
  }, { maxRetries: 2, initialDelayMs: 1000 });
}

/**
 * Generates embeddings for an array of text chunks using configurable batching.
 *
 * @param {string[]} texts - Array of chunk text strings
 * @param {Object} [options] - Batch options
 * @param {number} [options.batchSize] - Custom batch size
 * @returns {Promise<Array<number[]>>} - Array of 768-dimensional embedding arrays
 */
export async function generateBatchEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const batchSize = options.batchSize || DEFAULT_EMBEDDING_BATCH_SIZE;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map((chunkText) => generateEmbedding(chunkText));
    const batchResults = await Promise.all(batchPromises);

    for (const emb of batchResults) {
      if (!Array.isArray(emb) || emb.length !== EXPECTED_DIMENSIONS) {
        throw new Error(
          `Batch validation failed: embedding dimension is ${emb?.length}, expected ${EXPECTED_DIMENSIONS}.`
        );
      }
      allEmbeddings.push(emb);
    }
  }

  return allEmbeddings;
}
