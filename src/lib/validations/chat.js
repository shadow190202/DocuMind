import { z } from "zod";

/**
 * Validation schema for Phase 9 Question Answering requests.
 * Enforces boundaries:
 * - question: non-empty trimmed string, 1 to 2,000 characters
 * - documentId: optional valid UUID (scoped single-document query)
 * - conversationId: optional valid UUID (continue existing conversation)
 * - topK: integer between 1 and 20 (default 5)
 * - threshold: number between 0.0 and 1.0 (default 0.5)
 * - maxContextTokens: integer between 100 and 8000 (default 3000)
 */
export const chatRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty or whitespace only.")
    .max(2000, "Question exceeds maximum limit of 2,000 characters."),
  documentId: z
    .string()
    .uuid("Invalid document ID format.")
    .optional()
    .nullable(),
  conversationId: z
    .string()
    .uuid("Invalid conversation ID format.")
    .optional()
    .nullable(),
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
  maxContextTokens: z
    .number()
    .int("maxContextTokens must be an integer.")
    .min(100, "maxContextTokens must be at least 100.")
    .max(8000, "maxContextTokens cannot exceed 8,000.")
    .default(3000),
});
