import assert from "assert";
import {
  parseMarkdownBoldSegments,
  isMarkdownTable,
  parseTableCells,
} from "../../../src/lib/markdown.js";

export async function run() {
  console.log("\n--- Unit Tests: Markdown Processing Utilities ---");
  let passed = 0;

  // 1. Bold segments parsing
  const plainText = "Simple plain text without bolding";
  const plainSegments = parseMarkdownBoldSegments(plainText);
  assert.strictEqual(plainSegments.length, 1);
  assert.strictEqual(plainSegments[0].text, plainText);
  assert.strictEqual(plainSegments[0].bold, false);

  const mixedText = "Here is **bold text** and then **another bold** word.";
  const mixedSegments = parseMarkdownBoldSegments(mixedText);
  assert.strictEqual(mixedSegments.length, 5);
  assert.strictEqual(mixedSegments[0].text, "Here is ");
  assert.strictEqual(mixedSegments[0].bold, false);
  assert.strictEqual(mixedSegments[1].text, "bold text");
  assert.strictEqual(mixedSegments[1].bold, true);
  assert.strictEqual(mixedSegments[2].text, " and then ");
  assert.strictEqual(mixedSegments[2].bold, false);
  assert.strictEqual(mixedSegments[3].text, "another bold");
  assert.strictEqual(mixedSegments[3].bold, true);
  console.log("  ✅ parseMarkdownBoldSegments isolates bold segments and maintains text order");
  passed++;

  // 2. Markdown Table Detection
  const validTable = "| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |";
  assert.strictEqual(isMarkdownTable(validTable), true);

  const nonTable = "This is simply a multi-line paragraph.\nIt is definitely not a table.\nLine 3.";
  assert.strictEqual(isMarkdownTable(nonTable), false);

  const tableWithAlignment = "| Left | Center | Right |\n|:---|:---:|---:|\n| A | B | C |";
  assert.strictEqual(isMarkdownTable(tableWithAlignment), true);
  console.log("  ✅ isMarkdownTable correctly identifies valid tables and rejects plain paragraphs");
  passed++;

  // 3. Table Cell Extraction
  const row = "| Column A | Column B | Column C |";
  const cells = parseTableCells(row);
  assert.deepStrictEqual(cells, ["Column A", "Column B", "Column C"]);

  const rowWithoutOuterPipes = "Col1 | Col2 | Col3";
  const cellsWithoutOuter = parseTableCells(rowWithoutOuterPipes);
  assert.deepStrictEqual(cellsWithoutOuter, ["Col1", "Col2", "Col3"]);
  console.log("  ✅ parseTableCells trims and extracts cells across table row formats");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("markdown.test.mjs")) {
  run().then((r) => {
    console.log(`\nMarkdown unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Markdown unit tests failed:", err);
    process.exit(1);
  });
}
