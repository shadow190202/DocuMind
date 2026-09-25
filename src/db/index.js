import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let db = null;

export function getDb() {
  if (!db && process.env.DATABASE_URL) {
    // Disable prefetch for compatibility with connection poolers (Neon, Supabase, PgBouncer)
    // Configure bounded pool and timeouts for resilience
    const client = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    db = drizzle(client, { schema });
  }
  return db;
}

if (process.env.DATABASE_URL) {
  getDb();
}

export { db };
export * from "./schema.js";
