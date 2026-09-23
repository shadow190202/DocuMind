/**
 * Plain text (.txt) document parser
 * Decodes UTF-8 buffers, strips byte order marks, and normalizes line breaks.
 */
export async function parseTxt(buffer) {
  if (!buffer || buffer.length === 0) {
    return {
      text: "",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "" }],
      metadata: { format: "txt" },
    };
  }

  // Convert buffer to string
  let text = buffer.toString("utf8");

  // Strip UTF-8 Byte Order Mark (BOM) if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Normalize line endings (\r\n -> \n, \r -> \n)
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Remove null characters or non-printable control characters (except \n, \t)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Trim extraneous boundary whitespace
  text = text.trim();

  // If text contains form-feed characters (\f), split into virtual pages
  const rawPages = text.split(/\f+/).filter((p) => p.trim().length > 0);
  const pages = rawPages.length > 0
    ? rawPages.map((pageText, index) => ({
        pageNumber: index + 1,
        text: pageText.trim(),
      }))
    : [{ pageNumber: 1, text }];

  return {
    text,
    pageCount: pages.length,
    pages,
    metadata: {
      format: "txt",
    },
  };
}
