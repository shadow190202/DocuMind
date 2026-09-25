import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const regressionScripts = [
  "scripts/verify-phase8.mjs",
  "scripts/verify-phase9.mjs",
  "scripts/verify-phase9-5.mjs",
  "scripts/verify-phase10.mjs",
  "scripts/verify-phase11.mjs",
  "scripts/verify-phase12.mjs",
  "scripts/verify-phase13.mjs",
  "scripts/verify-phase14.mjs",
  "scripts/verify-phase15.mjs",
];

function runScript(relPath) {
  return new Promise((resolve, reject) => {
    console.log(`\n==========================================================`);
    console.log(`  Executing Historical Regression: ${relPath}`);
    console.log(`==========================================================`);

    const child = spawn("node", [path.resolve(rootDir, relPath)], {
      cwd: rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        DOCUMIND_MOCK_AI: "true",
      },
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${relPath} exited with non-zero exit code ${code}`));
      }
    });

    child.on("error", (err) => reject(err));
  });
}

export async function runAllRegressions() {
  console.log("==========================================================");
  console.log("      DocuMind Historical Regression Suites (Phases 8–15) ");
  console.log("==========================================================");

  let passedSuites = 0;
  let failedSuites = 0;

  for (const script of regressionScripts) {
    try {
      await runScript(script);
      passedSuites++;
    } catch (err) {
      console.error(`\n❌ REGRESSION FAILED in ${script}:`, err.message);
      failedSuites++;
      break; // Stop immediately on regression failure to provide clear diagnostics
    }
  }

  console.log("\n==========================================================");
  if (failedSuites === 0) {
    console.log(`  ALL HISTORICAL REGRESSIONS PASSED (${passedSuites}/${regressionScripts.length} suites)`);
  } else {
    console.error(`  HISTORICAL REGRESSIONS FAILED (${failedSuites} suite(s) failed)`);
  }
  console.log("==========================================================\n");

  return { passed: passedSuites, failed: failedSuites };
}

if (process.argv[1]?.endsWith("run-regressions.mjs")) {
  runAllRegressions().then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  });
}
