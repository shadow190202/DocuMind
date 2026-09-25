#!/usr/bin/env node

/**
 * DocuMind Admin Bootstrap Script
 *
 * Explicitly sets a user's role to 'admin' in PostgreSQL.
 * This is an explicit, out-of-band administrative maintenance tool,
 * completely decoupled from ordinary HTTP runtime authorization.
 *
 * Usage:
 *   node scripts/bootstrap-admin.mjs <user-email-or-id>
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, or } from "drizzle-orm";
import { users } from "../src/db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envLocalPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value.replace(/^["'](.*)["']$/, "$1");
        }
      }
    }
  }
}

const targetIdentifier = process.argv[2]?.trim();

if (!targetIdentifier) {
  console.error("❌ Error: Target user email or ID required.");
  console.log("Usage: node scripts/bootstrap-admin.mjs <email-or-userId>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL is not set in environment or .env.local");
  process.exit(1);
}

const sqlClient = postgres(connectionString, { max: 1 });
const db = drizzle(sqlClient);

async function bootstrapAdmin() {
  console.log(`Searching for user with email or ID: '${targetIdentifier}'...`);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, targetIdentifier), eq(users.id, targetIdentifier)));

  if (!existingUser) {
    console.error(`❌ User not found in database: '${targetIdentifier}'`);
    console.log("Note: The user must sign in to DocuMind at least once to create their local user row.");
    process.exit(1);
  }

  if (existingUser.role === "admin") {
    console.log(`ℹ️ User '${existingUser.email}' (${existingUser.id}) is already an administrator.`);
    process.exit(0);
  }

  const [updated] = await db
    .update(users)
    .set({
      role: "admin",
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  console.log("✅ Success! User promoted to administrator:");
  console.log(`   ID:    ${updated.id}`);
  console.log(`   Email: ${updated.email}`);
  console.log(`   Role:  ${updated.role}`);
  console.log(`   Updated: ${updated.updatedAt.toISOString()}`);
}

bootstrapAdmin()
  .catch((err) => {
    console.error("❌ Bootstrap failed with error:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await sqlClient.end();
  });
