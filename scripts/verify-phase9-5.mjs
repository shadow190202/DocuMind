import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql, count } from "drizzle-orm";
import { aiUsageLogs, users, documents, conversations, messages } from "../src/db/schema.js";
import { GroundedAnswerResponse, CHAT_MODEL } from "../src/lib/ai/gemini.js";

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

async function runPhase9_5Verification() {
  console.log("==================================================");
  console.log("  DocuMind Phase 9.5: AI Usage & Quota Awareness  ");
  console.log("==================================================\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  const testUserAlice = `test_p95_alice_${Date.now()}`;
  const testUserBob = `test_p95_bob_${Date.now()}`;
  const testUserCharlie = `test_p95_charlie_${Date.now()}`;

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Database Schema & Nullable Token Fields
    // ----------------------------------------------------
    console.log("--- 1. Testing Database Schema & Column Nullability ---");

    const cols = await sqlClient`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'ai_usage_logs'
    `;
    const colMap = {};
    for (const c of cols) {
      colMap[c.column_name] = c;
    }

    assert(Boolean(colMap.id), "ai_usage_logs.id column exists");
    assert(Boolean(colMap.user_id), "ai_usage_logs.user_id column exists");
    assert(Boolean(colMap.model), "ai_usage_logs.model column exists");
    assert(Boolean(colMap.operation), "ai_usage_logs.operation column exists");
    assert(Boolean(colMap.prompt_tokens), "ai_usage_logs.prompt_tokens column exists");
    assert(colMap.prompt_tokens.is_nullable === "YES", "prompt_tokens is nullable (handles missing metadata honestly)");
    assert(colMap.completion_tokens.is_nullable === "YES", "completion_tokens is nullable (handles missing metadata honestly)");
    assert(colMap.total_tokens.is_nullable === "YES", "total_tokens is nullable (handles missing metadata honestly)");
    assert(Boolean(colMap.created_at), "ai_usage_logs.created_at column exists");

    console.log("Database schema & nullability tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 2: Usage Recording & Verified Metadata
    // ----------------------------------------------------
    console.log("--- 2. Testing Usage Recording & Metadata Fidelity ---");

    // Create test users
    await db.insert(users).values([
      { id: testUserAlice, email: `${testUserAlice}@test.com` },
      { id: testUserBob, email: `${testUserBob}@test.com` },
      { id: testUserCharlie, email: `${testUserCharlie}@test.com` },
    ]);

    // Insert Log 1 for Alice: Complete official metadata
    const [insertedLog1] = await db
      .insert(aiUsageLogs)
      .values({
        userId: testUserAlice,
        model: CHAT_MODEL,
        operation: "chat",
        promptTokens: 2800,
        completionTokens: 650,
        totalTokens: 3450,
      })
      .returning();

    assert(insertedLog1.promptTokens === 2800, "Log 1 recorded exact prompt tokens (2800)");
    assert(insertedLog1.completionTokens === 650, "Log 1 recorded exact completion tokens (650)");
    assert(insertedLog1.totalTokens === 3450, "Log 1 recorded exact total tokens (3450)");

    // Insert Log 2 for Alice: Missing metadata (null tokens, honest representation)
    const [insertedLog2] = await db
      .insert(aiUsageLogs)
      .values({
        userId: testUserAlice,
        model: CHAT_MODEL,
        operation: "chat",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      })
      .returning();

    assert(insertedLog2.promptTokens === null, "Missing metadata recorded as null prompt_tokens (never fake 0)");
    assert(insertedLog2.completionTokens === null, "Missing metadata recorded as null completion_tokens (never fake 0)");
    assert(insertedLog2.totalTokens === null, "Missing metadata recorded as null total_tokens (never fake 0)");

    console.log("Metadata fidelity tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 3: Aggregation & Clean Zeroes
    // ----------------------------------------------------
    console.log("--- 3. Testing Aggregation & Honest Metrics ---");

    // Query aggregated stats for Alice
    const [aliceAgg] = await db
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::integer`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::integer`,
        questionsCount: count(aiUsageLogs.id),
        tokensUnavailableCount: sql`COUNT(CASE WHEN ${aiUsageLogs.totalTokens} IS NULL THEN 1 END)::integer`,
        lastUsedAt: sql`MAX(${aiUsageLogs.createdAt})`,
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, testUserAlice));

    assert(Number(aliceAgg.totalTokens) === 3450, "Alice totalTokens sum is 3450 (sum of known tokens)");
    assert(Number(aliceAgg.promptTokens) === 2800, "Alice promptTokens sum is 2800");
    assert(Number(aliceAgg.completionTokens) === 650, "Alice completionTokens sum is 650");
    assert(Number(aliceAgg.questionsCount) === 2, "Alice questionsCount is 2 (counts all completed questions)");
    assert(Number(aliceAgg.tokensUnavailableCount) === 1, "Alice tokensUnavailableCount is 1 (honest unavailable counter)");
    assert(Boolean(aliceAgg.lastUsedAt), "Alice lastUsedAt timestamp is present");

    // Query aggregated stats for brand-new User Charlie (zero usage)
    const [charlieAgg] = await db
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
        promptTokens: sql`COALESCE(SUM(${aiUsageLogs.promptTokens}), 0)::integer`,
        completionTokens: sql`COALESCE(SUM(${aiUsageLogs.completionTokens}), 0)::integer`,
        questionsCount: count(aiUsageLogs.id),
        tokensUnavailableCount: sql`COUNT(CASE WHEN ${aiUsageLogs.totalTokens} IS NULL THEN 1 END)::integer`,
        lastUsedAt: sql`MAX(${aiUsageLogs.createdAt})`,
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, testUserCharlie));

    assert(Number(charlieAgg.totalTokens) === 0, "New user Charlie totalTokens is cleanly 0");
    assert(Number(charlieAgg.promptTokens) === 0, "New user Charlie promptTokens is cleanly 0");
    assert(Number(charlieAgg.completionTokens) === 0, "New user Charlie completionTokens is cleanly 0");
    assert(Number(charlieAgg.questionsCount) === 0, "New user Charlie questionsCount is cleanly 0");
    assert(Number(charlieAgg.tokensUnavailableCount) === 0, "New user Charlie tokensUnavailableCount is cleanly 0");
    assert(charlieAgg.lastUsedAt === null, "New user Charlie lastUsedAt is cleanly null");

    console.log("Aggregation and clean zero tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 4: Multi-Tenant Security Isolation
    // ----------------------------------------------------
    console.log("--- 4. Testing Multi-Tenant Security Isolation ---");

    // User Bob querying usage sees ZERO of Alice's usage
    const [bobAgg] = await db
      .select({
        totalTokens: sql`COALESCE(SUM(${aiUsageLogs.totalTokens}), 0)::integer`,
        questionsCount: count(aiUsageLogs.id),
      })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, testUserBob));

    assert(Number(bobAgg.totalTokens) === 0, "MULTI-TENANT ISOLATION: Bob cannot see Alice's 3450 tokens");
    assert(Number(bobAgg.questionsCount) === 0, "MULTI-TENANT ISOLATION: Bob cannot see Alice's questions");

    console.log("Multi-tenant isolation tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 5: Atomic Transaction & Rollback Protection
    // ----------------------------------------------------
    console.log("--- 5. Testing Atomic Transaction & Rollback Behavior ---");

    // Simulate failed transaction: if error occurs, ai_usage_logs row must NOT be committed
    let rollbackErrorCaught = false;
    try {
      await db.transaction(async (tx) => {
        await tx.insert(aiUsageLogs).values({
          userId: testUserBob,
          model: CHAT_MODEL,
          operation: "chat",
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700,
        });

        // Deliberate simulated persistence failure
        throw new Error("Simulated downstream database persistence failure");
      });
    } catch (err) {
      rollbackErrorCaught = true;
    }

    assert(rollbackErrorCaught, "Simulated database transaction failure threw as expected");

    // Verify Bob STILL has 0 records (rolled back completely)
    const [bobAfterRollback] = await db
      .select({ count: count(aiUsageLogs.id) })
      .from(aiUsageLogs)
      .where(eq(aiUsageLogs.userId, testUserBob));

    assert(
      Number(bobAfterRollback.count) === 0,
      "ATOMICITY: Failed transaction completely rolled back; no orphaned usage row was created"
    );

    console.log("Atomic transaction & rollback tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 6: GroundedAnswerResponse & String Compatibility
    // ----------------------------------------------------
    console.log("--- 6. Testing GroundedAnswerResponse String & Usage Protocol ---");

    const fullResponse = new GroundedAnswerResponse("The revenue was $5M [SOURCE 1].", {
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      unavailable: false,
    });

    assert(typeof fullResponse === "object", "GroundedAnswerResponse is an object instance");
    assert(fullResponse instanceof String, "GroundedAnswerResponse inherits from String");
    assert(fullResponse.includes("revenue was $5M"), "String method .includes() works directly");
    assert(fullResponse.slice(0, 3) === "The", "String method .slice() works directly");
    assert(fullResponse.length > 0, "String property .length works directly");
    assert(fullResponse.toLowerCase().includes("revenue"), "String method .toLowerCase() works directly");
    assert(fullResponse.answer === "The revenue was $5M [SOURCE 1].", ".answer provides primitive string");
    assert(fullResponse.usage.totalTokens === 150, ".usage provides verified token counts");

    const unavailableResponse = new GroundedAnswerResponse("Answer text", {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      unavailable: true,
    });
    assert(unavailableResponse.usage.unavailable === true, "Handles unavailable metadata honestly");
    assert(unavailableResponse.usage.totalTokens === null, "Unavailable totalTokens is null");

    console.log("GroundedAnswerResponse protocol tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 7: Sidebar Component & Honest Wording Checks
    // ----------------------------------------------------
    console.log("--- 7. Testing Sidebar UI Wording & Quota Independence ---");

    const sidebarPath = path.resolve(__dirname, "../src/components/layout/sidebar.jsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf8");

    assert(sidebarContent.includes("AI Usage"), "Sidebar displays 'AI Usage' title");
    assert(sidebarContent.includes("tokens used"), "Sidebar displays '{count} tokens used'");
    assert(sidebarContent.includes("questions"), "Sidebar displays '{count} questions'");
    assert(
      sidebarContent.includes("Usage tracked by DocuMind. Provider-side quota may differ."),
      "Sidebar contains honest provider quota disclaimer"
    );
    assert(
      !sidebarContent.includes("% quota used"),
      "Sidebar DOES NOT display misleading '% quota used'"
    );
    assert(
      !sidebarContent.includes("tokens remaining"),
      "Sidebar DOES NOT display fabricated 'tokens remaining'"
    );
    assert(
      !sidebarContent.includes("Free quota remaining"),
      "Sidebar DOES NOT claim knowledge of Google free quota remaining"
    );

    console.log("Sidebar wording & quota independence tests passed!\n");

    // ----------------------------------------------------
    // TEST SUITE 8: 100% JavaScript & Invariants Check
    // ----------------------------------------------------
    console.log("--- 8. Testing 100% JavaScript & Dependency Invariants ---");

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
    assert(tsFound.length === 0, "Zero .ts or .tsx files in src/ directory (100% pure JavaScript)");

    console.log("\n==================================================");
    console.log(` ALL PHASE 9.5 VERIFICATIONS PASSED (${passedTests}/${totalTests})`);
    console.log("==================================================\n");
  } finally {
    // Cleanup test data
    console.log("Cleaning up test data...");
    await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserAlice));
    await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserBob));
    await db.delete(aiUsageLogs).where(eq(aiUsageLogs.userId, testUserCharlie));
    await db.delete(users).where(eq(users.id, testUserAlice));
    await db.delete(users).where(eq(users.id, testUserBob));
    await db.delete(users).where(eq(users.id, testUserCharlie));
    await sqlClient.end();
    console.log("Test data cleanup complete.\n");
  }
}

runPhase9_5Verification().catch((err) => {
  console.error("Phase 9.5 verification failed with error:", err);
  process.exit(1);
});
