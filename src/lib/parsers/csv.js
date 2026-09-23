import { parse } from "csv-parse/sync";

/**
 * CSV (.csv) document parser
 * Converts tabular CSV records into human & AI readable structured text representation.
 */
export async function parseCsv(buffer) {
  if (!buffer || buffer.length === 0) {
    return {
      text: "",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "" }],
      metadata: { format: "csv", rowCount: 0, columnCount: 0 },
    };
  }

  // Parse CSV records
  let records = [];
  try {
    records = parse(buffer, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch (parseErr) {
    // If strict parsing fails, fallback to loose line parsing
    const rawLines = buffer.toString("utf8").split(/\r?\n/).filter((l) => l.trim().length > 0);
    records = rawLines.map((line) => line.split(",").map((c) => c.trim()));
  }

  if (records.length === 0) {
    return {
      text: "",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "" }],
      metadata: { format: "csv", rowCount: 0, columnCount: 0 },
    };
  }

  const headers = records[0];
  const dataRows = records.slice(1);
  const totalRows = dataRows.length;
  const columnCount = headers.length;

  // Build semantic text representation
  const lines = [];
  lines.push(`Dataset Overview: CSV file containing ${totalRows} data rows across ${columnCount} columns.`);
  lines.push(`Columns: ${headers.join(", ")}`);
  lines.push("");

  // Segment rows into batches of 40 for virtual pages
  const ROWS_PER_PAGE = 40;
  const pages = [];
  let currentPageRows = [];
  let currentPageNumber = 1;

  dataRows.forEach((row, index) => {
    const rowNum = index + 1;
    const rowText = headers
      .map((header, colIdx) => `${header || `Col${colIdx + 1}`}: ${row[colIdx] ?? ""}`)
      .join(" | ");

    const formattedRow = `[Row ${rowNum}] ${rowText}`;
    lines.push(formattedRow);
    currentPageRows.push(formattedRow);

    if (currentPageRows.length >= ROWS_PER_PAGE || index === dataRows.length - 1) {
      pages.push({
        pageNumber: currentPageNumber,
        text: `Columns: ${headers.join(", ")}\n\n` + currentPageRows.join("\n"),
      });
      currentPageNumber++;
      currentPageRows = [];
    }
  });

  const fullText = lines.join("\n");

  return {
    text: fullText,
    pageCount: pages.length || 1,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText }],
    metadata: {
      format: "csv",
      rowCount: totalRows,
      columnCount,
      headers,
    },
  };
}
