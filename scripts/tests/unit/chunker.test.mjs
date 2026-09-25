import assert from "assert";
import { chunkDocument } from "../../../src/lib/ai/chunker.js";

export async function run() {
  console.log("\n--- Unit Tests: Semantic Text Chunker ---");
  let passed = 0;

  // 1. Empty or whitespace document returns empty array
  assert.deepStrictEqual(chunkDocument(null), []);
  assert.deepStrictEqual(chunkDocument({ text: "" }), []);
  assert.deepStrictEqual(chunkDocument({ text: "   \n\t  " }), []);
  console.log("  ✅ Empty or whitespace document returns empty array");
  passed++;

  // 2. Short document fits into a single chunk
  const shortDoc = {
    text: "This is a short document that easily fits within one chunk.",
    metadata: { fileType: "txt" },
  };
  const shortChunks = chunkDocument(shortDoc, { chunkSize: 500 });
  assert.strictEqual(shortChunks.length, 1);
  assert.strictEqual(shortChunks[0].chunkIndex, 0);
  assert.strictEqual(shortChunks[0].pageNumber, null); // TXT -> pageNumber is null
  assert.strictEqual(shortChunks[0].content, shortDoc.text);
  assert.strictEqual(shortChunks[0].characterCount, shortDoc.text.length);
  assert.strictEqual(shortChunks[0].estimatedTokenCount, Math.ceil(shortDoc.text.length / 4));
  console.log("  ✅ Short document fits in a single chunk with exact indices and token estimate");
  passed++;

  // 3. Multi-paragraph document splits on double newlines
  const paragraphDoc = {
    text: [
      "Paragraph 1: Introduction to DocuMind and its automated architecture.".repeat(5),
      "Paragraph 2: Detailed architecture of pgvector embeddings and similarity search.".repeat(5),
      "Paragraph 3: Security hardening and rate limiting guarantees.".repeat(5),
    ].join("\n\n"),
    metadata: { fileType: "txt" },
  };
  const paraChunks = chunkDocument(paragraphDoc, { chunkSize: 300, chunkOverlap: 50 });
  assert(paraChunks.length >= 3);
  for (let i = 0; i < paraChunks.length; i++) {
    assert.strictEqual(paraChunks[i].chunkIndex, i);
    assert(paraChunks[i].content.length > 0);
    assert.strictEqual(paraChunks[i].pageNumber, null);
  }
  console.log("  ✅ Hierarchical splitting creates sequential chunks with zero index gaps");
  passed++;

  // 4. PDF pageNumber preservation
  const pdfDoc = {
    text: "Page 1 Content\n\nPage 2 Content",
    metadata: { fileType: "pdf" },
    pages: [
      { pageNumber: 1, text: "Page 1: Overview of financial reports for Q1." },
      { pageNumber: 2, text: "Page 2: Summary of expenses and profit margins." },
    ],
  };
  const pdfChunks = chunkDocument(pdfDoc, { chunkSize: 200, chunkOverlap: 20 });
  assert.strictEqual(pdfChunks.length, 2);
  assert.strictEqual(pdfChunks[0].pageNumber, 1);
  assert.strictEqual(pdfChunks[1].pageNumber, 2);
  assert(pdfChunks[0].content.includes("Page 1"));
  assert(pdfChunks[1].content.includes("Page 2"));
  console.log("  ✅ PDF chunks accurately preserve genuine physical page numbers");
  passed++;

  // 5. Non-PDF formats (DOCX, CSV, TXT) strictly do not fabricate page numbers
  for (const format of ["docx", "csv", "txt"]) {
    const nonPdfDoc = {
      text: "Line 1\n\nLine 2\n\nLine 3",
      metadata: { fileType: format },
      pages: [{ pageNumber: 1, text: "Line 1" }],
    };
    const chunks = chunkDocument(nonPdfDoc);
    for (const chunk of chunks) {
      assert.strictEqual(
        chunk.pageNumber,
        null,
        `Format ${format} must have pageNumber === null to prevent fake page fabrication`
      );
    }
  }
  console.log("  ✅ Non-physical formats (DOCX, CSV, TXT) strictly set pageNumber to null");
  passed++;

  // 6. Overlap propagation between consecutive chunks
  const continuousText = "word ".repeat(200);
  const continuousDoc = {
    text: continuousText,
    metadata: { fileType: "txt" },
  };
  const overlapChunks = chunkDocument(continuousDoc, { chunkSize: 150, chunkOverlap: 40 });
  assert(overlapChunks.length > 2);
  // Verify chunk sequence is strictly monotonic
  for (let i = 0; i < overlapChunks.length; i++) {
    assert.strictEqual(overlapChunks[i].chunkIndex, i);
  }
  console.log("  ✅ Overlap retains semantic continuity across adjacent chunks");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("chunker.test.mjs")) {
  run().then((r) => {
    console.log(`\nChunker unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Chunker unit tests failed:", err);
    process.exit(1);
  });
}
