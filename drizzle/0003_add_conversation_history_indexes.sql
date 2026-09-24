CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_user_created_idx" ON "conversations" ("user_id", "created_at");
