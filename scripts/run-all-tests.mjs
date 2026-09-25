import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { runAllUnitTests } from "./tests/unit/run-unit-tests.mjs";
import { runAllIntegrationTests } from "./tests/integration/run-integration-tests.mjs";
import { runAllRegressions } from "./run-regressions.mjs";
import { getTestDb, auditZeroOrphans } from "./tests/utils/test-db.js";
import { installGeminiTransportGuard } from "./tests/utils/mock-ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function runPlaywrightE2E() {
  return new Promise((resolve, reject) => {
    console.log("\n==========================================================");
    console.log("       DocuMind Tier 3: Browser E2E Tests (Playwright)    ");
    console.log("==========================================================");

    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "npx.cmd" : "npx";

    const child = spawn(cmd, ["playwright", "test"], {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        DOCUMIND_E2E_MODE: "enabled",
        DOCUMIND_MOCK_AI: "true",
        DOCUMIND_E2E_SECRET: "documind_e2e_testing_secret_key_32chars",
      },
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright E2E tests exited with code ${code}`));
      }
    });

    child.on("error", (err) => reject(err));
  });
}

async function main() {
  const startTime = Date.now();
  console.log("==========================================================");
  console.log("        DocuMind Phase 16: Complete Test Orchestrator     ");
  console.log("==========================================================");

  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  let hasFailures = false;

  // 1. Tier 1: Unit Tests
  const unitResult = await runAllUnitTests();
  if (unitResult.failed > 0) {
    console.error(`❌ Tier 1 Unit tests had ${unitResult.failed} failures.`);
    hasFailures = true;
  }

  // 2. Tier 2: Integration Tests
  const intResult = await runAllIntegrationTests();
  if (intResult.failed > 0) {
    console.error(`❌ Tier 2 Integration tests had ${intResult.failed} failures.`);
    hasFailures = true;
  }

  // 3. Historical Regressions (Phases 8–15)
  const regResult = await runAllRegressions();
  if (regResult.failed > 0) {
    console.error(`❌ Historical regressions had ${regResult.failed} failures.`);
    hasFailures = true;
  }

  // 4. Optional Tier 3: Browser E2E Tests
  if (process.argv.includes("--with-e2e")) {
    try {
      await runPlaywrightE2E();
    } catch (e2eErr) {
      console.error(`❌ Tier 3 Playwright E2E tests failed:`, e2eErr.message);
      hasFailures = true;
    }
  }

  // 5. Final Authoritative Zero-Orphan Database Audit
  console.log("\n--- Final Master Zero-Orphan Database Audit ---");
  const db = getTestDb();
  if (db) {
    const finalAudit = await auditZeroOrphans(db);
    if (finalAudit.clean) {
      console.log("  ✅ ZERO residual test fixtures detected across all 9 application tables.");
    } else {
      console.error(`  ❌ Database audit failed: found ${finalAudit.orphanCount} orphaned records:`, finalAudit.orphans);
      hasFailures = true;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n==========================================================");
  if (!hasFailures) {
    console.log(`  🎉 ALL DOCUMIND TESTS PASSED IN ${durationSec}s! (0 Quota Consumed)`);
    console.log("==========================================================\n");
    process.exit(0);
  } else {
    console.error(`  💥 TEST SUITE FAILED IN ${durationSec}s.`);
    console.log("==========================================================\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during test run:", err);
  process.exit(1);
});
