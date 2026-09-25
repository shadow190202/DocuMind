import { z } from "zod";

/**
 * Validation schema for inviting / sharing a document with a collaborator.
 */
export const shareDocumentSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .toLowerCase(),
  permission: z
    .enum(["read", "write"], {
      errorMap: () => ({
        message: "Permission must be either 'read' (Viewer) or 'write' (Editor).",
      }),
    })
    .default("read"),
});

/**
 * Validation schema for updating a collaborator's permission role.
 */
export const updatePermissionSchema = z.object({
  permission: z.enum(["read", "write"], {
    errorMap: () => ({
      message: "Permission must be either 'read' (Viewer) or 'write' (Editor).",
    }),
  }),
});

/**
 * Validation schema for document and permission route parameters.
 */
export const permissionParamsSchema = z.object({
  id: z.string().uuid("Invalid document ID format."),
  permissionId: z.string().uuid("Invalid permission ID format."),
});
