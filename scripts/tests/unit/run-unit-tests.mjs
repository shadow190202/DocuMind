import { run as runParsers } from "./parsers.test.mjs";
import { run as runChunker } from "./chunker.test.mjs";
import { run as runValidations } from "./validations.test.mjs";
import { run as runRateLimiter } from "./rate-limiter.test.mjs";
import { run as runStorage } from "./storage.test.mjs";
import { run as runMarkdown } from "./markdown.test.mjs";
import { run as runErrors } from "./errors.test.mjs";

export async function runAllUnitTests() {
  console.log("==========================================================");
  console.log("       DocuMind Tier 1: Unit Test Suite Execution         ");
  console.log("==========================================================");

  let totalPassed = 0;
  let totalFailed = 0;

  const suites = [
    { name: "Parsers & Extraction", fn: runParsers },
    { name: "Semantic Text Chunker", fn: runChunker },
    { name: "Validation Schemas", fn: runValidations },
    { name: "Rate Limiter", fn: runRateLimiter },
    { name: "Storage Security", fn: runStorage },
    { name: "Markdown Utilities", fn: runMarkdown },
    { name: "Errors & Sanitization", fn: runErrors },
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

  console.log("\n==========================================================");
  if (totalFailed === 0) {
    console.log(`  ALL UNIT TESTS PASSED: ${totalPassed}/${totalPassed} assertions`);
  } else {
    console.error(`  UNIT TESTS FAILED: ${totalFailed} suites/assertions failed`);
  }
  console.log("==========================================================\n");

  return { passed: totalPassed, failed: totalFailed };
}

if (process.argv[1]?.endsWith("run-unit-tests.mjs")) {
  runAllUnitTests().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  });
}
