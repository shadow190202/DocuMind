import { z } from "zod";

/**
 * Validation schema for updating a user's role.
 */
export const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    errorMap: () => ({
      message: "Role must be either 'user' or 'admin'.",
    }),
  }),
});

/**
 * Validation schema for admin user listing queries.
 */
export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().default(""),
  role: z.enum(["all", "user", "admin"]).default("all"),
  sortBy: z
    .enum(["recent", "oldest", "name", "documents", "questions", "tokens"])
    .default("recent"),
});

/**
 * Validation schema for admin document listing queries.
 */
export const adminDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().default(""),
  status: z
    .enum(["all", "completed", "processing", "failed", "pending"])
    .default("all"),
  fileType: z
    .enum(["all", "pdf", "docx", "txt", "csv"])
    .default("all"),
  sortBy: z.enum(["recent", "oldest", "name", "size"]).default("recent"),
});

/**
 * Validation schema for admin telemetry time range.
 */
export const adminStatsQuerySchema = z.object({
  timeRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
});
