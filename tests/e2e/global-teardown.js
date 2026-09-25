import { getTestDb, auditZeroOrphans } from "../../scripts/tests/utils/test-db.js";

export default async function globalTeardown() {
  console.log("\n[E2E Global Teardown] Running authoritative zero-orphan audit...");
  const db = getTestDb();
  if (db) {
    const audit = await auditZeroOrphans(db);
    if (!audit.clean) {
      console.error(`[E2E Global Teardown] ❌ Found ${audit.orphanCount} orphaned test records:`, audit.orphans);
      throw new Error(`E2E Zero-Orphan Invariant Violated: ${audit.orphanCount} records left behind.`);
    }
    console.log("[E2E Global Teardown] ✅ 0 orphaned test records confirmed across all 9 application tables.");
  }
}
