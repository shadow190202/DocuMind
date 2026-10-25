-- DocuMind: 24-Hour Retention Window Migration
-- Updates default expires_at on documents table to 24 hours

ALTER TABLE "documents" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '24 hours';
