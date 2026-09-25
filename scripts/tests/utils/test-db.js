import fs from "fs";
import path from "path";
import crypto from "crypto";
import { sql, eq, or, like } from "drizzle-orm";
import { db, getDb } from "../../../src/db/index.js";
import {
  users,
  documents,
  documentChunks,
  conversations,
  messages,
  documentPermissions,
  documentSummaries,
  documentComparisons,
  aiUsageLogs,
} from "../../../src/db/schema.js";

// Ensure .env.local is loaded in standalone test executions
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^["'](.*)["']$/, "$1");
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  }
}

/**
 * Returns an active drizzle database instance.
 */
export function getTestDb() {
  return db || getDb();
}

/**
 * Generates a unique, non-colliding test run identifier.
 * Prefix strictly set to 'dmtest_' for unambiguous detection and auditing.
 *
 * @param {string} [scope='run']
 * @returns {string}
 */
export function createTestRunId(scope = "run") {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex");
  return `dmtest_${scope}_${ts}_${rand}`;
}

/**
 * Inserts an isolated test user into PostgreSQL.
 *
 * @param {any} db
 * @param {{ id: string, email: string, name?: string, role?: string }} userData
 */
export async function createTestUser(db, userData) {
  const [created] = await db
    .insert(users)
    .values({
      id: userData.id,
      email: userData.email,
      name: userData.name || `Test User ${userData.id}`,
      role: userData.role || "user",
    })
    .returning();
  return created;
}

/**
 * Deterministically tears down all database records created during a specific test run.
 * Deletions execute in reverse foreign-key dependency order.
 *
 * @param {any} db
 * @param {string} testRunId
 */
export async function cleanupTestRunFixtures(db, testRunId) {
  if (!db || !testRunId || typeof testRunId !== "string" || !testRunId.startsWith("dmtest_")) {
    return;
  }

  const matchPattern = `${testRunId}%`;

  try {
    // 1. Delete derived comparison and summary records
    await db.execute(sql`
      DELETE FROM document_comparisons 
      WHERE user_id LIKE ${matchPattern} 
         OR source_document_id IN (SELECT id FROM documents WHERE user_id LIKE ${matchPattern})
         OR target_document_id IN (SELECT id FROM documents WHERE user_id LIKE ${matchPattern});
    `);

    await db.execute(sql`
      DELETE FROM document_summaries 
      WHERE user_id LIKE ${matchPattern} 
         OR document_id IN (SELECT id FROM documents WHERE user_id LIKE ${matchPattern});
    `);

    // 2. Delete messages and conversations
    await db.execute(sql`
      DELETE FROM messages 
      WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id LIKE ${matchPattern});
    `);

    await db.execute(sql`
      DELETE FROM conversations 
      WHERE user_id LIKE ${matchPattern};
    `);

    // 3. Delete permissions
    await db.execute(sql`
      DELETE FROM document_permissions 
      WHERE user_id LIKE ${matchPattern}
         OR document_id IN (SELECT id FROM documents WHERE user_id LIKE ${matchPattern});
    `);

    // 4. Delete chunks and documents
    await db.execute(sql`
      DELETE FROM document_chunks 
      WHERE document_id IN (SELECT id FROM documents WHERE user_id LIKE ${matchPattern});
    `);

    await db.execute(sql`
      DELETE FROM documents 
      WHERE user_id LIKE ${matchPattern};
    `);

    // 5. Delete AI usage logs
    await db.execute(sql`
      DELETE FROM ai_usage_logs 
      WHERE user_id LIKE ${matchPattern};
    `);

    // 6. Delete users
    await db.execute(sql`
      DELETE FROM users 
      WHERE id LIKE ${matchPattern};
    `);
  } catch (err) {
    console.warn(`Warning during cleanup for testRunId '${testRunId}':`, err.message);
  }
}

/**
 * Authoritatively scans all 9 application tables for residual test records matching 'dmtest_%' or 'test_%'.
 *
 * @param {any} db
 * @returns {Promise<{ clean: boolean, orphanCount: number, orphans: Array<{ table: string, id: string }> }>}
 */
export async function auditZeroOrphans(db) {
  const orphanQueries = [
    sql`SELECT 'users' AS table_name, id::text AS record_id FROM users WHERE id LIKE 'dmtest_%' OR id LIKE 'test_%'`,
    sql`SELECT 'documents' AS table_name, id::text AS record_id FROM documents WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
    sql`SELECT 'document_chunks' AS table_name, dc.id::text AS record_id FROM document_chunks dc JOIN documents d ON dc.document_id = d.id WHERE d.user_id LIKE 'dmtest_%' OR d.user_id LIKE 'test_%'`,
    sql`SELECT 'conversations' AS table_name, id::text AS record_id FROM conversations WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
    sql`SELECT 'messages' AS table_name, m.id::text AS record_id FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.user_id LIKE 'dmtest_%' OR c.user_id LIKE 'test_%'`,
    sql`SELECT 'document_summaries' AS table_name, id::text AS record_id FROM document_summaries WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
    sql`SELECT 'document_comparisons' AS table_name, id::text AS record_id FROM document_comparisons WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
    sql`SELECT 'document_permissions' AS table_name, id::text AS record_id FROM document_permissions WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
    sql`SELECT 'ai_usage_logs' AS table_name, id::text AS record_id FROM ai_usage_logs WHERE user_id LIKE 'dmtest_%' OR user_id LIKE 'test_%'`,
  ];

  const fullAuditSql = sql.join(orphanQueries, sql` UNION ALL `);
  const rawResults = await db.execute(fullAuditSql);
  const rows = Array.isArray(rawResults) ? rawResults : rawResults?.rows || [];

  const orphans = rows.map((r) => ({
    table: r.table_name,
    id: r.record_id,
  }));

  return {
    clean: orphans.length === 0,
    orphanCount: orphans.length,
    orphans,
  };
}
