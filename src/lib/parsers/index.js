import { parsePdf } from "./pdf.js";
import { parseDocx } from "./docx.js";
import { parseTxt } from "./txt.js";
import { parseCsv } from "./csv.js";

/**
 * Master document text extractor
 * Dispatches file buffer to corresponding parser based on fileType.
 *
 * @param {Buffer} fileBuffer - The binary buffer of the file
 * @param {string} fileType - One of 'pdf', 'docx', 'txt', 'csv'
 * @returns {Promise<{
 *   text: string,
 *   pageCount: number,
 *   pages: Array<{ pageNumber: number, text: string }>,
 *   metadata: Object
 * }>}
 */
export async function extractTextFromDocument(fileBuffer, fileType) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error("Invalid file buffer provided for text extraction.");
  }

  const normalizedType = (fileType || "").toLowerCase().trim().replace(/^\./, "");

  let parseResult;

  switch (normalizedType) {
    case "pdf":
      parseResult = await parsePdf(fileBuffer);
      break;
    case "docx":
      parseResult = await parseDocx(fileBuffer);
      break;
    case "txt":
      parseResult = await parseTxt(fileBuffer);
      break;
    case "csv":
      parseResult = await parseCsv(fileBuffer);
      break;
    default:
      throw new Error(
        `Unsupported document format for text extraction: "${fileType}". Supported formats: PDF, DOCX, TXT, CSV.`
      );
  }

  const rawText = parseResult.text || "";
  const characterCount = rawText.length;
  // Word count: split non-empty words
  const words = rawText.trim() ? rawText.trim().split(/\s+/) : [];
  const wordCount = words.length;
  // Line count
  const lines = rawText ? rawText.split("\n") : [];
  const lineCount = lines.length;

  return {
    text: rawText,
    pageCount: parseResult.pageCount || 1,
    pages: parseResult.pages || [{ pageNumber: 1, text: rawText }],
    metadata: {
      ...(parseResult.metadata || {}),
      fileType: normalizedType,
      characterCount,
      wordCount,
      lineCount,
      extractedAt: new Date().toISOString(),
    },
  };
}
