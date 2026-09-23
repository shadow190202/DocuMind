import mammoth from "mammoth";

/**
 * Word (.docx) document parser using Mammoth
 * Extracts plain text from DOCX binaries and normalizes paragraphs.
 */
export async function parseDocx(buffer) {
  if (!buffer || buffer.length === 0) {
    return {
      text: "",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "" }],
      metadata: { format: "docx" },
    };
  }

  const result = await mammoth.extractRawText({ buffer });
  let text = result.value || "";

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Condense 3+ newlines down to 2
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  // DOCX flow layout doesn't provide explicit physical page numbers,
  // so segment by ~3,000 characters or logical double newlines for virtual pages
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const pages = [];
  let currentPageText = [];
  let currentLength = 0;
  let pageNumber = 1;

  for (const para of paragraphs) {
    currentPageText.push(para);
    currentLength += para.length;

    // Segment roughly around 2,500 characters per virtual page
    if (currentLength >= 2500) {
      pages.push({
        pageNumber,
        text: currentPageText.join("\n\n"),
      });
      pageNumber++;
      currentPageText = [];
      currentLength = 0;
    }
  }

  if (currentPageText.length > 0) {
    pages.push({
      pageNumber,
      text: currentPageText.join("\n\n"),
    });
  }

  return {
    text,
    pageCount: pages.length || 1,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text }],
    metadata: {
      format: "docx",
      messages: result.messages || [],
    },
  };
}
