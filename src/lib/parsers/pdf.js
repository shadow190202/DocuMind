import { PDFParse } from "pdf-parse";

/**
 * PDF (.pdf) document parser using pdf-parse v2
 * Extracts full text and per-page text content.
 */
export async function parsePdf(buffer) {
  if (!buffer || buffer.length === 0) {
    return {
      text: "",
      pageCount: 0,
      pages: [],
      metadata: { format: "pdf" },
    };
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const normalizedText = (result.text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();

    // Map extracted pages
    const rawPages = result.pages || [];
    const pages = rawPages.map((p, idx) => ({
      pageNumber: p.num || idx + 1,
      text: (p.text || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim(),
    }));

    return {
      text: normalizedText,
      pageCount: result.total || pages.length || 1,
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: normalizedText }],
      metadata: {
        format: "pdf",
        total: result.total || pages.length || 1,
      },
    };
  } finally {
    try {
      await parser.destroy();
    } catch {
      // Ignore destroy errors if already cleaned up
    }
  }
}
