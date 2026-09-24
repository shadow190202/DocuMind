import { z } from "zod";

export const SUMMARY_TYPES = [
  "executive",
  "detailed",
  "key_points",
  "dates",
  "numbers",
  "action_items",
  "comprehensive",
];

export const summarizeRequestSchema = z.object({
  summaryType: z
    .enum(SUMMARY_TYPES, {
      errorMap: () => ({
        message: `Invalid summary type. Must be one of: ${SUMMARY_TYPES.join(", ")}`,
      }),
    })
    .default("executive"),
  regenerate: z.boolean().default(false),
});

export const getSummaryQuerySchema = z.object({
  type: z.enum([...SUMMARY_TYPES, "all"]).optional().default("all"),
});
