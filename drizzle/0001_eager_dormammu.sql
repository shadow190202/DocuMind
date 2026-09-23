ALTER TABLE "document_chunks" ADD COLUMN "chunk_index" integer DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS "document_chunks_doc_chunk_idx" ON "document_chunks" ("document_id", "chunk_index");