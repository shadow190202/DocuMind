import { getTestDb } from "../../scripts/tests/utils/test-db.js";
import { sql } from "drizzle-orm";

export default async function globalSetup() {
  console.log("\n[E2E Global Setup] Initializing clean test environment...");
  const db = getTestDb();
  if (db) {
    try {
      // Purge any stale test fixtures from interrupted runs
      await db.execute(sql`
        DELETE FROM document_comparisons WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM document_summaries WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%');
        DELETE FROM conversations WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM document_permissions WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%');
        DELETE FROM documents WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM ai_usage_logs WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%';
        DELETE FROM users WHERE id LIKE 'dmtest_%' OR id LIKE 'test_%';
      `);
      console.log("[E2E Global Setup] Clean baseline verified.");
    } catch (e) {
      console.warn("[E2E Global Setup] Warning during initial sweep:", e.message);
    }
  }
}
