import { GoogleGenAI } from "@google/genai";

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";
export const EXPECTED_DIMENSIONS = 768;
export const DEFAULT_EMBEDDING_BATCH_SIZE = parseInt(
  process.env.EMBEDDING_BATCH_SIZE || "20",
  10
);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isUpstreamUnavailableError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  const msg = (error.message || "").toLowerCase();

  return (
    status === 503 ||
    status === "503" ||
    status === "UNAVAILABLE" ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

export function isUpstreamRateLimitError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  const msg = (error.message || "").toLowerCase();

  return (
    status === 429 ||
    status === "429" ||
    status === "RESOURCE_EXHAUSTED" ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota")
  );
}

export function isTransientNetworkError(error) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("network error") ||
    msg.includes("socket hang up")
  );
}

export function isTransientError(error) {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  if (isUpstreamRateLimitError(error) || isUpstreamUnavailableError(error) || isTransientNetworkError(error)) {
    return true;
  }
  return status === 500 || status === 502;
}

export class UpstreamHighDemandError extends Error {
  constructor(
    message = "The AI service is temporarily experiencing high traffic. Please try your request again in a few moments."
  ) {
    super(message);
    this.name = "UpstreamHighDemandError";
    this.status = 503;
    this.statusCode = 503;
    this.code = "UPSTREAM_HIGH_DEMAND";
    this.isHighDemand = true;
  }
}

export class UpstreamRateLimitError extends Error {
  constructor(
    message = "Rate limit reached. Please wait a moment before sending another request."
  ) {
    super(message);
    this.name = "UpstreamRateLimitError";
    this.status = 429;
    this.statusCode = 429;
    this.code = "UPSTREAM_RATE_LIMITED";
    this.isRateLimit = true;
  }
}

/**
 * Executes a Gemini AI operation with jittered exponential backoff for transient errors.
 */
export async function executeWithRetry(opName, fn, options = {}) {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const backoffFactor = options.backoffFactor ?? 2;
  const jitterMs = options.jitterMs ?? 300;

  let delay = initialDelayMs;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isUnavailable = isUpstreamUnavailableError(err);
      const isRateLimit = isUpstreamRateLimitError(err);
      const isNetwork = isTransientNetworkError(err);

      if ((isUnavailable || isRateLimit || isNetwork) && attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * jitterMs);
        const sleepTime = delay + jitter;
        console.warn(
          `[Gemini Retry] ${opName} encountered transient error (${attempt + 1}/${maxRetries + 1}): ${err.message}. Retrying in ${sleepTime}ms...`
        );
        await sleep(sleepTime);
        delay *= backoffFactor;
        continue;
      }

      if (isUnavailable) throw new UpstreamHighDemandError();
      if (isRateLimit) throw new UpstreamRateLimitError();
      throw err;
    }
  }

  if (isUpstreamUnavailableError(lastError)) throw new UpstreamHighDemandError();
  if (isUpstreamRateLimitError(lastError)) throw new UpstreamRateLimitError();
  throw lastError;
}

/**
 * Returns an initialized GoogleGenAI instance.
 */
export function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "GEMINI_API_KEY is not configured in environment variables. A valid Gemini API key is required."
    );
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

// Re-exports for modular domain engines and full backward compatibility
export {
  generateEmbedding,
  generateBatchEmbeddings,
} from "./embeddings.js";

export {
  DEFAULT_GROUNDED_SYSTEM_INSTRUCTION,
  buildGroundedPrompt,
  GroundedAnswerResponse,
  generateGroundedAnswer,
} from "./chat.js";

export {
  DEFAULT_SUMMARIZATION_SYSTEM_INSTRUCTION,
  buildSummarizationPrompt,
  callGeminiSummarizer,
  combineUsageMetrics,
  generateDocumentSummary,
} from "./summarizer.js";

export {
  DEFAULT_COMPARISON_SYSTEM_INSTRUCTION,
  SIMILARITY_HIGH,
  SIMILARITY_MODERATE,
  TOP_K_CANDIDATES,
  MAX_SEMANTIC_UNITS,
  UNITS_PER_MAP_CALL,
  MAX_MAP_CALLS,
  computeCosineSimilarity,
  buildDocumentComparisonPrompt,
  buildBidirectionalCandidateAlignment,
  generateDocumentComparison,
} from "./comparator.js";
