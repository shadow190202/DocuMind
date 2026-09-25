import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let db = null;

export function getDb() {
  if (!db && process.env.DATABASE_URL) {
    // Disable prefetch for compatibility with connection poolers (Neon, Supabase, PgBouncer)
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}

if (process.env.DATABASE_URL) {
  getDb();
}

export { db };
export * from "./schema.js";
