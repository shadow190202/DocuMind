import { getTestDb, auditZeroOrphans } from "../utils/test-db.js";
import { installGeminiTransportGuard } from "../utils/mock-ai.js";
import { run as runDocs } from "./documents-api.test.mjs";
import { run as runVectors } from "./vector-search.test.mjs";
import { run as runPermissions } from "./permissions-api.test.mjs";
import { run as runChat } from "./chat-api.test.mjs";
import { run as runSummarize } from "./summarize-api.test.mjs";
import { run as runCompare } from "./compare-api.test.mjs";
import { run as runAdmin } from "./admin-api.test.mjs";
import { run as runSecurityPhase15 } from "./security-phase15.test.mjs";

export async function runAllIntegrationTests() {
  console.log("==========================================================");
  console.log("    DocuMind Tier 2: Integration Test Suite Execution     ");
  console.log("==========================================================");

  installGeminiTransportGuard();
  process.env.DOCUMIND_MOCK_AI = "true";

  let totalPassed = 0;
  let totalFailed = 0;

  const suites = [
    { name: "Documents API Lifecycle", fn: runDocs },
    { name: "Controlled Vector Search", fn: runVectors },
    { name: "Permissions Hierarchy", fn: runPermissions },
    { name: "Chat, Citations & Telemetry", fn: runChat },
    { name: "Document Summaries & Cache", fn: runSummarize },
    { name: "Document Comparison", fn: runCompare },
    { name: "Admin Authorization & Directory", fn: runAdmin },
    { name: "Phase 15 Security Invariants", fn: runSecurityPhase15 },
  ];

  for (const suite of suites) {
    try {
      const res = await suite.fn();
      totalPassed += res.passed;
      totalFailed += res.failed;
    } catch (err) {
      console.error(`❌ Suite failed: ${suite.name}`, err);
      totalFailed++;
    }
  }

  // Authoritative Zero-Orphan Database Audit across all 9 application tables
  console.log("\n--- Authoritative Zero-Orphan Database Audit ---");
  const db = getTestDb();
  const audit = await auditZeroOrphans(db);

  if (audit.clean) {
    console.log("  ✅ ZERO residual test fixtures detected across all 9 application tables.");
    totalPassed++;
  } else {
    console.error(`  ❌ Database audit failed: found ${audit.orphanCount} orphaned records:`, audit.orphans);
    totalFailed++;
  }

  console.log("\n==========================================================");
  if (totalFailed === 0) {
    console.log(`  ALL INTEGRATION TESTS PASSED: ${totalPassed}/${totalPassed} assertions`);
  } else {
    console.error(`  INTEGRATION TESTS FAILED: ${totalFailed} suites/assertions failed`);
  }
  console.log("==========================================================\n");

  return { passed: totalPassed, failed: totalFailed };
}

if (process.argv[1]?.endsWith("run-integration-tests.mjs")) {
  runAllIntegrationTests().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  });
}
