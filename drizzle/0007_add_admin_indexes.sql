-- DocuMind Phase 14: Administrative & Monitoring Performance Indexes
-- Idempotent index creation to optimize administrative aggregation queries and concurrency-safe role locks

-- 1. Index on users(role) to optimize role-based lookups and FOR UPDATE locking
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");

-- 2. Composite index on documents(processing_status, created_at) for processing queue & failure monitoring
CREATE INDEX IF NOT EXISTS "documents_status_created_idx" ON "documents" ("processing_status", "created_at");

-- 3. Index on documents(created_at) for time-series upload trend analytics
CREATE INDEX IF NOT EXISTS "documents_created_idx" ON "documents" ("created_at");

-- 4. Composite index on ai_usage_logs(operation, created_at) for operation breakdowns and AI telemetry
CREATE INDEX IF NOT EXISTS "ai_usage_logs_op_created_idx" ON "ai_usage_logs" ("operation", "created_at");
