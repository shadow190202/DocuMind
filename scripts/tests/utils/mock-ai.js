import crypto from "crypto";

export const EXPECTED_DIMENSIONS = 768;

/**
 * Installs a strict transport guard on global fetch to guarantee zero real Google Gemini calls.
 * Throws immediately with a loud fatal error if any network request targets Google Gemini API.
 */
let isGuardInstalled = false;
export function installGeminiTransportGuard() {
  if (isGuardInstalled) return;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function guardedFetch(input, init) {
    const urlString = typeof input === "string" ? input : input?.url || "";

    if (
      process.env.DOCUMIND_MOCK_AI === "true" &&
      urlString.includes("generativelanguage.googleapis.com")
    ) {
      throw new Error(
        `FATAL_SECURITY_VIOLATION: Live Google Gemini API transport attempted during mock test execution (${urlString})! Normal test suites must NEVER consume live Gemini quota.`
      );
    }

    return originalFetch.call(this, input, init);
  };

  isGuardInstalled = true;
}

/**
 * Creates an exact unit vector along a single specified axis (e.g. axis 0).
 * Cosine similarity between two identical axis vectors is strictly 1.0.
 *
 * @param {number} [dim=768]
 * @param {number} [axis=0]
 * @returns {number[]}
 */
export function createAxisUnitVector(dim = EXPECTED_DIMENSIONS, axis = 0) {
  const vec = new Array(dim).fill(0.0);
  vec[axis] = 1.0;
  return vec;
}

/**
 * Creates the exact opposite of a vector (-vec).
 * Cosine similarity between vec and -vec is strictly -1.0.
 *
 * @param {number[]} vec
 * @returns {number[]}
 */
export function createOppositeVector(vec) {
  return vec.map((x) => (x === 0 ? 0.0 : -x));
}

/**
 * Creates a controlled vector with known intermediate cosine similarity to the primary axis (axisA).
 * For example, at angle θ = π/4 (45 degrees), cosine similarity is cos(π/4) ≈ 0.70710678.
 *
 * @param {number} [dim=768]
 * @param {number} [axisA=0]
 * @param {number} [axisB=1]
 * @param {number} [angle=Math.PI/4]
 * @returns {number[]}
 */
export function createIntermediateVector(
  dim = EXPECTED_DIMENSIONS,
  axisA = 0,
  axisB = 1,
  angle = Math.PI / 4
) {
  const vec = new Array(dim).fill(0.0);
  vec[axisA] = Math.cos(angle);
  vec[axisB] = Math.sin(angle);
  return vec;
}

/**
 * Calculates mathematical cosine similarity between two float vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function computeMathematicalCosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dotProduct / magnitude;
}

/**
 * Generates a normalized, deterministic 768-dimensional float embedding seeded by SHA-256.
 * Guaranteed to be offline, fast, and repeatable.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function generateDeterministicMockEmbedding(text) {
  const clean = typeof text === "string" ? text : String(text || "");
  const hash = crypto.createHash("sha256").update(clean).digest();

  const vec = new Array(EXPECTED_DIMENSIONS);
  let sumSq = 0;

  for (let i = 0; i < EXPECTED_DIMENSIONS; i++) {
    // Generate pseudo-float between -1.0 and 1.0
    const byteVal = hash[i % hash.length];
    const pseudoVal = (byteVal + (i % 17) * 7) % 256;
    const floatVal = (pseudoVal / 128) - 1.0;
    vec[i] = floatVal;
    sumSq += floatVal * floatVal;
  }

  // Normalize to unit length (L2 norm = 1.0)
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map((v) => Math.round((v / norm) * 100000) / 100000);
}

/**
 * Generates a deterministic mock grounded answer citing source evidence.
 *
 * @param {{ question: string, contextText?: string }} options
 * @returns {{ answer: string, usage: { promptTokens: number, completionTokens: number, totalTokens: number } }}
 */
export function generateMockGroundedAnswer({ question, contextText = "" }) {
  if (!contextText || contextText.trim().length === 0) {
    return {
      answer: "I do not have sufficient information in the provided document context to answer your question.",
      usage: { promptTokens: 40, completionTokens: 18, totalTokens: 58 },
    };
  }

  const answer = `Based on [SOURCE 1], the answer to "${question}" is substantiated by the document records. Key findings confirm operations conform to reported figures.`;

  return {
    answer,
    usage: { promptTokens: 250, completionTokens: 42, totalTokens: 292 },
  };
}
