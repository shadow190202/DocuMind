-- DocuMind: 3-Hour Retention Lifecycle Migration
-- Adds expires_at column and index on documents table

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone DEFAULT (NOW() + INTERVAL '3 hours') NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_expires_at_idx" ON "documents" ("expires_at");
