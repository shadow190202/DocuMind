CREATE TABLE IF NOT EXISTS "document_comparisons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "target_document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "structured_data" jsonb,
  "model" text NOT NULL,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "total_tokens" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "doc_comparisons_pair_uniq_idx" ON "document_comparisons" ("source_document_id", "target_document_id");
CREATE INDEX IF NOT EXISTS "doc_comparisons_user_created_idx" ON "document_comparisons" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "doc_comparisons_source_idx" ON "document_comparisons" ("source_document_id");
CREATE INDEX IF NOT EXISTS "doc_comparisons_target_idx" ON "document_comparisons" ("target_document_id");
