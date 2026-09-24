import { z } from "zod";

/**
 * Validation schema for renaming a conversation (PATCH /api/conversations/:id).
 */
export const updateConversationSchema = z.object({
  title: z
    .string({ required_error: "Title is required." })
    .trim()
    .min(1, "Title cannot be empty or whitespace only.")
    .max(100, "Title cannot exceed 100 characters."),
});

/**
 * Validation schema for querying conversation history (GET /api/conversations).
 * Enforces server-side search, filtering, and sorting parameters.
 */
export const listConversationsQuerySchema = z.object({
  search: z.string().trim().max(100, "Search query cannot exceed 100 characters.").optional(),
  documentId: z.string().uuid("Invalid document ID format.").optional().nullable(),
  timeRange: z.enum(["all", "24h", "7d", "30d"]).default("all"),
  sort: z.enum(["recent", "oldest", "most_questions", "title"]).default("recent"),
  limit: z.coerce.number().int().min(1, "Limit must be at least 1.").max(100, "Limit cannot exceed 100.").default(20),
  offset: z.coerce.number().int().min(0, "Offset cannot be negative.").default(0),
});

/**
 * Validation schema for exporting conversation transcripts (GET /api/conversations/:id/export).
 */
export const exportConversationQuerySchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
});
