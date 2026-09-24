import { z } from "zod";

/**
 * Validation schema for semantic vector search requests.
 * Enforces strict boundaries:
 * - topK: integer between 1 and 20 (inclusive)
 * - threshold: number between 0.0 and 1.0 (inclusive)
 * - query: trimmed non-empty string up to 2,000 characters
 */
export const searchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query cannot be empty or whitespace only.")
    .max(2000, "Search query exceeds maximum limit of 2,000 characters."),
  topK: z
    .number()
    .int("topK must be an integer.")
    .min(1, "topK must be at least 1.")
    .max(20, "topK cannot exceed 20.")
    .default(5),
  threshold: z
    .number()
    .min(0.0, "threshold must be at least 0.0.")
    .max(1.0, "threshold cannot exceed 1.0.")
    .default(0.5),
  documentId: z
    .string()
    .uuid("Invalid document ID format.")
    .optional(),
  documentIds: z
    .array(z.string().uuid("Invalid document ID format."))
    .max(50, "Cannot specify more than 50 document IDs.")
    .optional(),
  includeContext: z
    .boolean()
    .default(false),
  maxContextTokens: z
    .number()
    .int()
    .min(100, "maxContextTokens must be at least 100.")
    .max(16000, "maxContextTokens cannot exceed 16,000.")
    .default(3000),
});
