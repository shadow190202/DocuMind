import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load .env.local if present and DATABASE_URL is not already set
if (!process.env.DATABASE_URL) {
  const envLocalPath = path.resolve(rootDir, ".env.local");
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
}

/**
 * Validates basic email address structure.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Strips sensitive credentials from error messages.
 * @param {string} str
 * @returns {string}
 */
function sanitizeOutput(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/gi, "[REDACTED_DATABASE_URL]");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("❌ Invalid arguments.");
    console.error("Usage: node scripts/bootstrap-admin.mjs <target-email>");
    console.error("Example: node scripts/bootstrap-admin.mjs admin@example.com");
    process.exit(1);
  }

  const targetEmail = args[0].trim().toLowerCase();

  if (!isValidEmail(targetEmail)) {
    console.error(`❌ Invalid email format: "${args[0]}". Please provide a valid email address.`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ Database connection error: DATABASE_URL is not set in the environment or .env.local.");
    process.exit(1);
  }

  console.log(`Connecting to database to verify user "${targetEmail}"...`);

  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });

  const db = drizzle(sql, { schema });

  try {
    // 1. Look up the existing user by email
    const [existingUser] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.email, targetEmail));

    if (!existingUser) {
      console.error(
        `❌ User not found: No user registered with email "${targetEmail}".\n` +
          `   The user must first sign up / sign in via Clerk so their account record exists in PostgreSQL.\n` +
          `   DocuMind strictly requires an existing user record and will never fabricate phantom users.`
      );
      process.exitCode = 1;
      return;
    }

    // 2. Check if already an admin
    if (existingUser.role === "admin") {
      console.log(`ℹ️ User "${targetEmail}" (ID: ${existingUser.id}) is already an administrator.`);
      console.log("   No changes were made.");
      return;
    }

    // 3. Promote only this specific user to 'admin'
    await db
      .update(schema.users)
      .set({
        role: "admin",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, existingUser.id));

    console.log(`✅ Success: User "${targetEmail}" (ID: ${existingUser.id}) has been promoted to administrator.`);
    console.log("   PostgreSQL authoritative authorization (users.role = 'admin') is active.");
  } catch (error) {
    console.error("❌ Database operation failed:", sanitizeOutput(error.message));
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", sanitizeOutput(err.message));
  process.exit(1);
});
