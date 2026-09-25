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
