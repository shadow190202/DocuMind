/**
 * Recursive Semantic Text Chunker
 *
 * Implements hierarchical text splitting with semantic boundaries:
 * 1. Double line breaks (\n\n - paragraphs / sections)
 * 2. Single line breaks (\n - lines / rows)
 * 3. Sentence boundaries (. , ? , ! )
 * 4. Word boundaries (spaces)
 * 5. Character-level fallback
 *
 * Preserves genuine physical page numbers for PDFs.
 * Sets pageNumber to null for non-physical formats (DOCX, TXT, CSV) to avoid fabrication.
 */

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

/**
 * Splits a text into recursive semantic chunks.
 *
 * @param {string} text - Text to split
 * @param {number} chunkSize - Target character length per chunk
 * @param {number} chunkOverlap - Overlap in characters between adjacent chunks
 * @returns {string[]} - Array of chunk content strings
 */
function recursiveSplit(text, chunkSize, chunkOverlap) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (trimmed.length <= chunkSize) {
    return [trimmed];
  }

  const separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""];

  function splitRecursive(currentText, sepIndex) {
    if (currentText.length <= chunkSize) {
      return [currentText.trim()].filter(Boolean);
    }

    if (sepIndex >= separators.length - 1) {
      // Character-level hard split fallback
      const chunks = [];
      let i = 0;
      while (i < currentText.length) {
        chunks.push(currentText.substring(i, i + chunkSize));
        i += chunkSize - chunkOverlap;
      }
      return chunks;
    }

    const separator = separators[sepIndex];
    let parts;
    if (separator === "") {
      parts = Array.from(currentText);
    } else {
      parts = currentText.split(separator);
    }

    const mergedChunks = [];
    let currentChunk = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const testChunk = currentChunk
        ? currentChunk + separator + part
        : part;

      if (testChunk.length <= chunkSize) {
        currentChunk = testChunk;
      } else {
        if (currentChunk.trim().length > 0) {
          mergedChunks.push(currentChunk.trim());
        }

        if (part.length > chunkSize) {
          // Sub-split this oversized part with the next separator
          const subChunks = splitRecursive(part, sepIndex + 1);
          mergedChunks.push(...subChunks);
          currentChunk = "";
        } else {
          // Carry over overlap from the end of the previous chunk if available
          if (chunkOverlap > 0 && currentChunk.length > chunkOverlap) {
            const overlapText = currentChunk.slice(-chunkOverlap);
            currentChunk = overlapText + separator + part;
          } else {
            currentChunk = part;
          }
        }
      }
    }

    if (currentChunk.trim().length > 0) {
      mergedChunks.push(currentChunk.trim());
    }

    return mergedChunks;
  }

  return splitRecursive(trimmed, 0);
}

/**
 * Chunks extracted document content into structured chunks with metadata.
 *
 * @param {Object} extractedData - Output from extractTextFromDocument()
 * @param {string} extractedData.text - Full extracted document text
 * @param {string} extractedData.metadata.fileType - Document format ('pdf', 'docx', 'txt', 'csv')
 * @param {Array<{ pageNumber: number, text: string }>} [extractedData.pages] - Extracted page objects
 * @param {Object} [options] - Configuration options
 * @param {number} [options.chunkSize=1000] - Target chunk size in characters
 * @param {number} [options.chunkOverlap=200] - Overlap between consecutive chunks
 * @returns {Array<{
 *   chunkIndex: number,
 *   content: string,
 *   pageNumber: number|null,
 *   characterCount: number,
 *   estimatedTokenCount: number
 * }>}
 */
export function chunkDocument(extractedData, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap !== undefined ? options.chunkOverlap : DEFAULT_CHUNK_OVERLAP;

  if (!extractedData || !extractedData.text || extractedData.text.trim().length === 0) {
    return [];
  }

  const fileType = (extractedData.metadata?.fileType || "").toLowerCase().trim();
  const isPdf = fileType === "pdf";
  const rawPages = Array.isArray(extractedData.pages) ? extractedData.pages : [];

  const chunks = [];
  let chunkIndex = 0;

  if (isPdf && rawPages.length > 0) {
    // For PDFs: preserve genuine physical page numbers
    for (const page of rawPages) {
      const pageText = (page.text || "").trim();
      if (!pageText) continue;

      const pageChunks = recursiveSplit(pageText, chunkSize, chunkOverlap);
      for (const chunkContent of pageChunks) {
        if (!chunkContent) continue;
        chunks.push({
          chunkIndex: chunkIndex++,
          content: chunkContent,
          pageNumber: page.pageNumber || null,
          characterCount: chunkContent.length,
          // Clearly documented as an estimate (approx. 4 characters per token)
          estimatedTokenCount: Math.ceil(chunkContent.length / 4),
        });
      }
    }
  } else {
    // For DOCX, TXT, CSV: no physical pages exist; pageNumber is explicitly null
    const fullText = extractedData.text.trim();
    const textChunks = recursiveSplit(fullText, chunkSize, chunkOverlap);

    for (const chunkContent of textChunks) {
      if (!chunkContent) continue;
      chunks.push({
        chunkIndex: chunkIndex++,
        content: chunkContent,
        pageNumber: null, // Never fabricate fake page numbers
        characterCount: chunkContent.length,
        estimatedTokenCount: Math.ceil(chunkContent.length / 4),
      });
    }
  }

  return chunks;
}
