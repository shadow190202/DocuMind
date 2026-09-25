-- 1. Deterministic duplicate cleanup: write wins over read, oldest row retained, tie-break by id
WITH ranked_permissions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY document_id, user_id 
      ORDER BY 
        CASE WHEN permission = 'write' THEN 1 ELSE 2 END ASC,
        created_at ASC,
        id ASC
    ) as rn
  FROM "document_permissions"
)
DELETE FROM "document_permissions"
WHERE id IN (
  SELECT id FROM ranked_permissions WHERE rn > 1
);
--> statement-breakpoint
ALTER TABLE "document_permissions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "doc_permissions_doc_user_uniq_idx" ON "document_permissions" ("document_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_permissions_user_idx" ON "document_permissions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "doc_permissions_doc_idx" ON "document_permissions" ("document_id");
