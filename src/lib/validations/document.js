import { z } from "zod";

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

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
