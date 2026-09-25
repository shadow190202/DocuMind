import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";
import {
  generateEmbedding,
  generateGroundedAnswer,
  EXPECTED_DIMENSIONS,
} from "../../src/lib/ai/gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env.local is loaded if GEMINI_API_KEY is not already in environment
if (!process.env.GEMINI_API_KEY) {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, "$1");
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  }
}

async function runLiveAiSmokeTest() {
  console.log("==========================================================");
  console.log("   DocuMind Live Gemini API Smoke Test (Explicit Opt-In)  ");
  console.log("==========================================================");

  if (!process.env.GEMINI_API_KEY) {
    console.log("⚠️  SKIPPED: GEMINI_API_KEY is not set in the environment or .env.local.");
    console.log("   To run live Gemini smoke tests, configure GEMINI_API_KEY and run:");
    console.log("   npm run test:ai-live\n");
    process.exit(0);
  }

  console.log("Note: This test connects to Google Gemini API (Free Tier).");
  console.log("Normal test suites (npm test) never run this test.\n");

  try {
    // 1. Test live embedding generation via existing export
    console.log("1. Testing generateEmbedding() with real Gemini endpoint...");
    const sampleText = "DocuMind automated knowledge retrieval and document intelligence.";
    const embedding = await generateEmbedding(sampleText);

    assert(Array.isArray(embedding), "Embedding must be an array");
    assert.strictEqual(
      embedding.length,
      EXPECTED_DIMENSIONS,
      `Embedding must have exactly ${EXPECTED_DIMENSIONS} dimensions`
    );
    assert(
      embedding.some((val) => typeof val === "number" && val !== 0),
      "Embedding must contain non-zero numerical floats"
    );
    console.log(`  ✅ generateEmbedding succeeded: received 768-dim float vector.`);

    // 2. Test live grounded answer generation via existing export
    console.log("\n2. Testing generateGroundedAnswer() with real Gemini endpoint...");
    const question = "What is the primary feature of DocuMind?";
    const contextText = "DocuMind provides AI-powered document intelligence and semantic search across PDF, DOCX, TXT, and CSV formats.";

    const result = await generateGroundedAnswer({
      question,
      contextText,
      conversationHistory: [],
    });

    assert(typeof result.answer === "string" && result.answer.trim().length > 0, "Must return answer text");
    assert(result.usage, "Must return usage object");
    assert(typeof result.usage.totalTokens === "number", "Must track total tokens");
    console.log(`  ✅ generateGroundedAnswer succeeded:`);
    console.log(`     Answer: "${result.answer.substring(0, 100)}..."`);
    console.log(`     Tokens: ${result.usage.totalTokens} (Prompt: ${result.usage.promptTokens}, Completion: ${result.usage.completionTokens})`);

    console.log("\n==========================================================");
    console.log("  ALL LIVE AI SMOKE TESTS PASSED (0 Quota Exceeded)");
    console.log("==========================================================\n");
  } catch (err) {
    console.error("❌ Live AI smoke test failed:", err.message);
    process.exit(1);
  }
}

runLiveAiSmokeTest();
