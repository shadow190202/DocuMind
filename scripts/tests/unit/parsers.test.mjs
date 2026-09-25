import assert from "assert";
import { extractTextFromDocument } from "../../../src/lib/parsers/index.js";
import { parseTxt } from "../../../src/lib/parsers/txt.js";
import { parseCsv } from "../../../src/lib/parsers/csv.js";

export async function run() {
  console.log("\n--- Unit Tests: Parsers & Text Extraction ---");
  let passed = 0;

  // 1. TXT parsing - standard utf8
  const sampleText = "DocuMind Unit Testing\nLine 2: Semantic search and RAG assistant.\nLine 3: Complete verification.";
  const txtBuffer = Buffer.from(sampleText, "utf8");
  const txtResult = await extractTextFromDocument(txtBuffer, "txt");
  assert.strictEqual(txtResult.text, sampleText);
  assert.strictEqual(txtResult.pageCount, 1);
  assert.strictEqual(txtResult.metadata.fileType, "txt");
  assert.strictEqual(txtResult.metadata.lineCount, 3);
  assert.strictEqual(txtResult.metadata.characterCount, sampleText.length);
  assert(txtResult.metadata.wordCount > 5);
  console.log("  ✅ TXT extraction correctly extracts text, lines, words, and metadata");
  passed++;

  // 2. CSV parsing - standard comma delimited
  const csvData = "id,name,role\n1,Alice,admin\n2,Bob,user\n3,Charlie,analyst";
  const csvBuffer = Buffer.from(csvData, "utf8");
  const csvResult = await extractTextFromDocument(csvBuffer, "csv");
  assert(csvResult.text.includes("Alice"));
  assert(csvResult.text.includes("admin"));
  assert.strictEqual(csvResult.metadata.fileType, "csv");
  assert.strictEqual(csvResult.pageCount, 1);
  console.log("  ✅ CSV extraction formats tabular data with columns and rows");
  passed++;

  // 3. CSV parsing - single-column CSV (no commas, single header and values)
  const singleColCsv = "header_item\nvalue_one\nvalue_two\nvalue_three";
  const singleColBuffer = Buffer.from(singleColCsv, "utf8");
  const singleColResult = await parseCsv(singleColBuffer);
  assert(singleColResult.text.includes("header_item"));
  assert(singleColResult.text.includes("value_one"));
  assert.strictEqual(singleColResult.metadata.rowCount, 3);
  console.log("  ✅ CSV extraction handles single-column CSV without delimiter errors");
  passed++;

  // 4. CSV parsing - quoted values with internal commas and newlines
  const quotedCsv = 'id,summary\n1,"Summary with, commas and\nnewline inside quotes"\n2,"Simple summary"';
  const quotedBuffer = Buffer.from(quotedCsv, "utf8");
  const quotedResult = await parseCsv(quotedBuffer);
  assert(quotedResult.text.includes("Summary with, commas"));
  assert.strictEqual(quotedResult.metadata.rowCount, 2);
  console.log("  ✅ CSV extraction safely parses quoted fields with commas and newlines");
  passed++;

  // 5. TXT parsing direct
  const directTxtResult = await parseTxt(Buffer.from("Direct TXT Parser test", "utf8"));
  assert.strictEqual(directTxtResult.text, "Direct TXT Parser test");
  assert.strictEqual(directTxtResult.pageCount, 1);
  console.log("  ✅ parseTxt returns valid contract directly");
  passed++;

  // 6. Unsupported document format rejection
  let errorCaught = false;
  try {
    await extractTextFromDocument(Buffer.from("invalid", "utf8"), "exe");
  } catch (err) {
    errorCaught = true;
    assert(err.message.includes("Unsupported document format"));
  }
  assert.strictEqual(errorCaught, true);
  console.log("  ✅ Unsupported document format throws descriptive error");
  passed++;

  // 7. Non-buffer argument rejection
  let nonBufferError = false;
  try {
    await extractTextFromDocument("not-a-buffer", "txt");
  } catch (err) {
    nonBufferError = true;
    assert(err.message.includes("Invalid file buffer"));
  }
  assert.strictEqual(nonBufferError, true);
  console.log("  ✅ Non-buffer input is rejected with assertion error");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("parsers.test.mjs")) {
  run().then((r) => {
    console.log(`\nParser unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Parser unit tests failed:", err);
    process.exit(1);
  });
}
