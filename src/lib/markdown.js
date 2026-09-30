/**
 * Lightweight Markdown parsing utilities for DocuMind.
 * 100% pure JavaScript without external dependencies.
 */

/**
 * Parses markdown bold tokens into an array of plain and bold text segments.
 * e.g. "Hello **world**" -> [{ text: "Hello ", bold: false }, { text: "world", bold: true }]
 *
 * @param {string} text - Raw string possibly containing **bold** delimiters
 * @returns {Array<{ text: string, bold: boolean }>}
 */
export function parseMarkdownBoldSegments(text) {
  if (typeof text !== "string" || !text.includes("**")) {
    return [{ text: text || "", bold: false }];
  }

  const segments = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.substring(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), bold: false });
  }

  return segments;
}

/**
 * Checks if a trimmed block represents a markdown table.
 *
 * @param {string} trimmedBlock - Text block to evaluate
 * @returns {boolean}
 */
export function isMarkdownTable(trimmedBlock) {
  if (typeof trimmedBlock !== "string") return false;
  const lines = trimmedBlock
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;

  const firstLine = lines[0];
  if (!firstLine.includes("|")) return false;

  // Check if line 1 or line 2 is a markdown table separator: e.g. |---|---| or |:---|---:|
  return lines
    .slice(1, 3)
    .some(
      (line) =>
        /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(line) ||
        (/^[\s|:-]+$/.test(line) && line.includes("-") && line.includes("|"))
    );
}

/**
 * Parses pipe-delimited table rows into an array of trimmed string cells.
 *
 * @param {string} line - Single table row string
 * @returns {string[]}
 */
export function parseTableCells(line) {
  let clean = (line || "").trim();
  if (clean.startsWith("|")) clean = clean.slice(1);
  if (clean.endsWith("|")) clean = clean.slice(0, -1);
  return clean.split("|").map((cell) => cell.trim());
}

/**
 * Parses a string into inline tokens: bold (**text**), italic (*text* or _text_),
 * inline code (`code`), source citations ([SOURCE 1]), and plain text.
 *
 * @param {string} text - Raw inline text
 * @returns {Array<{ type: 'text'|'bold'|'italic'|'code'|'source', text: string, value?: string }>}
 */
export function parseInlineTokens(text) {
  if (typeof text !== "string" || text.length === 0) {
    return [];
  }

  // Matches bold (**...**), inline code (`...`), source tags ([SOURCE ...]), and italic (*...* or _..._)
  // Note: Italic requires non-whitespace immediately inside delimiters per CommonMark rules
  const tokenRegex = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[SOURCE\s*(\d+(?:\s*,\s*\d+)*)\])|(\*(?!\s)([^*]+?)(?<!\s)\*)|(_(?!\s)([^_]+?)(?<!\s)_)/gi;

  const tokens = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      tokens.push({
        type: "text",
        text: text.substring(lastIndex, matchIndex),
      });
    }

    if (match[2] !== undefined) {
      // Bold: **...**
      tokens.push({
        type: "bold",
        text: match[2],
      });
    } else if (match[4] !== undefined) {
      // Inline Code: `...`
      tokens.push({
        type: "code",
        text: match[4],
      });
    } else if (match[6] !== undefined) {
      // Source citation: [SOURCE ...]
      tokens.push({
        type: "source",
        text: match[5],
        value: match[6].trim(),
      });
    } else if (match[8] !== undefined || match[10] !== undefined) {
      // Italic: *...* or _..._
      tokens.push({
        type: "italic",
        text: match[8] !== undefined ? match[8] : match[10],
      });
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      text: text.substring(lastIndex),
    });
  }

  return tokens;
}

/**
 * Splits markdown content into structural blocks respecting code block fences.
 *
 * @param {string} text - Raw markdown document or message
 * @returns {string[]} - Array of block strings
 */
export function splitMarkdownBlocks(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.split("\n");
  const blocks = [];
  let currentBlock = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      currentBlock.push(line);
      if (!inCodeBlock) {
        blocks.push(currentBlock.join("\n"));
        currentBlock = [];
      }
      continue;
    }

    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }

    if (trimmed === "") {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join("\n"));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks;
}
