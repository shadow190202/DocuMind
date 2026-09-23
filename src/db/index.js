import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const connectionString = process.env.DATABASE_URL;

let db = null;

if (connectionString) {
  // Disable prefetch for compatibility with connection poolers (Neon, Supabase, PgBouncer)
  const client = postgres(connectionString, { prepare: false });
  db = drizzle(client, { schema });
}

export { db };
export * from "./schema.js";
