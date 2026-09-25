import { z } from "zod";

/**
 * Zod validation schema for POST /api/documents/compare
 */
export const compareDocumentsRequestSchema = z
  .object({
    sourceDocumentId: z
      .string({
        required_error: "Source document ID is required.",
      })
      .uuid({ message: "Invalid source document ID. Must be a valid UUID." }),
    targetDocumentId: z
      .string({
        required_error: "Target document ID is required.",
      })
      .uuid({ message: "Invalid target document ID. Must be a valid UUID." }),
    regenerate: z.boolean().default(false),
  })
  .refine((data) => data.sourceDocumentId !== data.targetDocumentId, {
    message: "Source and target documents must be distinct. Cannot compare a document to itself.",
    path: ["targetDocumentId"],
  });

/**
 * Zod validation schema for GET /api/documents/compare query parameters
 */
export const getComparisonQuerySchema = z
  .object({
    sourceId: z.string().uuid({ message: "Invalid source document ID format." }).optional(),
    targetId: z.string().uuid({ message: "Invalid target document ID format." }).optional(),
    recent: z.enum(["true", "false"]).optional(),
  })
  .refine(
    (data) => {
      // Must be either recent=true query OR both sourceId and targetId provided and distinct
      if (data.recent === "true") {
        return true;
      }
      return Boolean(data.sourceId && data.targetId && data.sourceId !== data.targetId);
    },
    {
      message: "Query must specify recent=true or both distinct sourceId and targetId.",
    }
  );
