import { z } from "zod";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB strictly preserved

export const SUPPORTED_FILE_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/csv": "csv",
};

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv"];

/**
 * Validates uploaded file metadata.
 */
export const fileUploadSchema = z.object({
  filename: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename is too long")
    .refine((name) => {
      const lower = name.toLowerCase();
      return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    }, "Unsupported file format. Please upload a PDF, DOCX, TXT, or CSV file."),
  size: z
    .number()
    .positive("File cannot be empty")
    .max(MAX_FILE_SIZE, "File size exceeds the 20MB limit."),
  type: z.string().optional(),
});

/**
 * Detects normalized file type ('pdf', 'docx', 'txt', 'csv') based on filename and MIME type.
 * @param {string} filename 
 * @param {string} mimeType 
 * @returns {'pdf' | 'docx' | 'txt' | 'csv' | null}
 */
export function getNormalizedFileType(filename, mimeType) {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".pdf")) return "pdf";
  if (lowerName.endsWith(".docx")) return "docx";
  if (lowerName.endsWith(".txt")) return "txt";
  if (lowerName.endsWith(".csv")) return "csv";

  if (mimeType && SUPPORTED_FILE_TYPES[mimeType]) {
    return SUPPORTED_FILE_TYPES[mimeType];
  }

  return null;
}

/**
 * Deep binary magic-byte and structural integrity inspection for uploaded document buffers.
 *
 * Guarantees & Security Invariants:
 * 1. Preserves 20 MB size limit (MAX_FILE_SIZE).
 * 2. PDF: Verifies %PDF- magic bytes; strictly rejects executable binaries (MZ, ELF, Mach-O).
 * 3. DOCX: Verifies PK header (0x50 0x4B 0x03 0x04) and OpenXML structural markers ([Content_Types].xml or word/);
 *    verifies zip entries do not contain directory traversal sequences (../).
 * 4. TXT: Verifies valid UTF-8 and strictly rejects null bytes (\0) while allowing harmless text control characters (\t, \r, \n, \f).
 * 5. CSV: Verifies valid UTF-8 and strictly rejects null bytes (\0); allows single-column CSVs without forced delimiters.
 *
 * @param {Buffer} buffer - Raw file buffer
 * @param {'pdf' | 'docx' | 'txt' | 'csv'} fileType - Expected normalized file type
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDocumentBuffer(buffer, fileType) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { valid: false, error: "Invalid document buffer." };
  }

  if (buffer.length === 0) {
    return { valid: false, error: "File buffer cannot be empty." };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum allowed size of 20MB (${buffer.length} bytes).` };
  }

  // Common executable binary signatures to reject across all document formats
  const isPE = buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a; // 'MZ'
  const isELF = buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46; // '\x7fELF'
  const isMachO = buffer.length >= 4 && (
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
    (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe)
  );

  if (isPE || isELF || isMachO) {
    return { valid: false, error: "Security violation: disguised executable binary detected." };
  }

  if (fileType === "pdf") {
    // PDF magic bytes: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (buffer.length < 5) {
      return { valid: false, error: "Invalid PDF: file is too small." };
    }
    const pdfMagic = buffer.subarray(0, 5).toString("ascii");
    if (!pdfMagic.startsWith("%PDF-")) {
      return { valid: false, error: "Invalid PDF format: missing '%PDF-' header signature." };
    }
    return { valid: true };
  }

  if (fileType === "docx") {
    // DOCX ZIP magic bytes: 'PK\x03\x04' (0x50 0x4B 0x03 0x04)
    if (buffer.length < 4) {
      return { valid: false, error: "Invalid DOCX: file is too small." };
    }
    const hasZipHeader = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!hasZipHeader) {
      return { valid: false, error: "Invalid DOCX format: missing standard OpenXML ZIP archive header." };
    }

    // Safe OpenXML archive entry validation
    const hasOpenXmlEntry =
      buffer.includes(Buffer.from("[Content_Types].xml")) ||
      buffer.includes(Buffer.from("word/")) ||
      buffer.includes(Buffer.from("word/document.xml"));

    if (!hasOpenXmlEntry) {
      return { valid: false, error: "Invalid DOCX format: archive does not contain standard Word OpenXML structures." };
    }

    // ZIP path traversal guard
    if (buffer.includes(Buffer.from("../")) || buffer.includes(Buffer.from("..\\"))) {
      return { valid: false, error: "DOCX security violation: directory traversal sequence detected in archive." };
    }

    return { valid: true };
  }

  if (fileType === "txt" || fileType === "csv") {
    // Reject binary null bytes
    if (buffer.includes(0x00)) {
      return { valid: false, error: `Invalid ${fileType.toUpperCase()}: binary null bytes detected.` };
    }

    // Verify valid UTF-8 decodability
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      decoder.decode(buffer);
    } catch {
      return { valid: false, error: `Invalid ${fileType.toUpperCase()}: text is not valid UTF-8.` };
    }

    return { valid: true };
  }

  return { valid: true };
}
