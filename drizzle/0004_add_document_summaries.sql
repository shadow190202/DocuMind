CREATE TABLE IF NOT EXISTS "document_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "summary_type" text NOT NULL,
  "content" text NOT NULL,
  "structured_data" jsonb,
  "model" text NOT NULL,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "total_tokens" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "doc_summaries_doc_type_uniq_idx" ON "document_summaries" ("document_id", "summary_type");
CREATE INDEX IF NOT EXISTS "doc_summaries_user_created_idx" ON "document_summaries" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "doc_summaries_doc_idx" ON "document_summaries" ("document_id");
