# DocuMind — Production Troubleshooting Runbook

This runbook provides remediation procedures for common operational issues encountered when deploying or running DocuMind in production.

---

## 1. Database & pgvector Issues

### Symptom: `ECONNREFUSED` or `ETIMEDOUT` during container startup or migration
* **Root Cause:** Application cannot establish a network connection to PostgreSQL, or connection parameters are malformed.
* **Diagnosis:**
  1. Check `DATABASE_URL` in `.env` to verify hostname, port, and credentials.
  2. For cloud providers (Neon, Supabase), verify that `?sslmode=require` is present in the connection string.
  3. Ensure network firewalls allow outbound connections to port 5432 or 6543 (PgBouncer).
* **Remediation:**
  Test direct connectivity from the server:
  ```bash
  psql "$DATABASE_URL" -c "SELECT NOW();"
  ```

### Symptom: `type "vector" does not exist` or `extension "vector" is not available`
* **Root Cause:** The PostgreSQL instance does not have the `pgvector` extension installed.
* **Diagnosis:**
  Execute in PostgreSQL:
  ```sql
  SELECT * FROM pg_available_extensions WHERE name = 'vector';
  ```
* **Remediation:**
  1. If `pgvector` is available, create the extension:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
  2. If using self-hosted PostgreSQL, install the extension package (e.g. `postgresql-16-pgvector`) and restart the PostgreSQL service.
  3. If using managed PostgreSQL (Neon, Supabase), ensure you are connected to a database version with vector support enabled.

### Symptom: Database migration fails with `relation already exists` or lock timeout
* **Root Cause:** A previous migration was partially interrupted, or multiple processes ran migrations simultaneously.
* **Diagnosis:**
  Inspect the migration history table:
  ```sql
  SELECT * FROM __drizzle_migrations ORDER BY created_at ASC;
  ```
* **Remediation:**
  Do NOT use `drizzle-kit push`. Instead, verify which migration file failed, ensure table definitions match `src/db/schema.js`, and re-run:
  ```bash
  npm run db:migrate
  ```

---

## 2. Document Storage & Volume Issues

### Symptom: `EACCES: permission denied, mkdir '/app/storage'` or file upload failures
* **Root Cause:** The non-root container user (`nextjs`, UID 1001) lacks write permissions to the host-mounted volume directory.
* **Diagnosis:**
  Inspect host directory permissions:
  ```bash
  ls -ld /var/data/documind/storage
  ```
* **Remediation:**
  Change ownership on the host:
  ```bash
  sudo chown -R 1001:1001 /var/data/documind/storage
  sudo chmod -R 750 /var/data/documind/storage
  ```

### Symptom: Uploaded documents disappear after container restart or rebuild
* **Root Cause:** Persistent host volume was not mounted when running `docker run`, causing files to be written to the container's ephemeral layer.
* **Diagnosis:**
  Inspect the container mounts:
  ```bash
  docker inspect documind --format '{{ json .Mounts }}'
  ```
* **Remediation:**
  Always mount the host storage volume when starting the container:
  ```bash
  -v /var/data/documind/storage:/app/storage
  ```

---

## 3. Clerk Authentication & CSP Issues

### Symptom: Sign-in modal fails to load or browser console shows Content Security Policy violations
* **Root Cause:** Production Clerk domains are blocked by Content Security Policy.
* **Diagnosis:**
  Open browser developer tools (Console tab). Check for errors like:
  ```text
  Refused to load the script 'https://clerk.yourdomain.com/npm/...' because it violates the Content-Security-Policy directive.
  ```
* **Remediation:**
  1. Verify that `next.config.mjs` includes `https://*.clerk.com` in `scriptSrc`, `connect-src`, and `frame-src`.
  2. If using a custom Clerk domain (e.g., `clerk.yourdomain.com`), add your specific custom domain to `connect-src`, `scriptSrc`, and `frame-src` in `next.config.mjs`.

### Symptom: Infinite redirect loop between `/dashboard` and `/sign-in`
* **Root Cause:** Mismatch between Clerk session cookies and `NEXT_PUBLIC_CLERK_*` redirect URLs, or clock skew on the server.
* **Diagnosis:**
  Check server system time:
  ```bash
  timedatectl status
  ```
* **Remediation:**
  1. Synchronize server clock using NTP (`sudo apt install systemd-timesyncd`).
  2. Verify that `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` in `.env` are set to `/dashboard`.
  3. Ensure reverse proxy passes `Host` and `X-Forwarded-Proto https` headers correctly.

---

## 4. Google Gemini API & Rate Limiting

### Symptom: `Gemini API error: 429 RESOURCE_EXHAUSTED` in server logs
* **Root Cause:** Google Gemini free-tier provider quota has been exhausted.
* **Diagnosis:**
  $$\text{Application Rate Limiting (10 req/min/IP)} \neq \text{Google Provider Quota}$$
  The application throttles individual burst traffic, but aggregate traffic across all users can reach Google's provider quota.
* **Remediation:**
  1. DocuMind automatically performs 3 retries with exponential backoff (1s, 2s, 4s). If all retries fail, a user-safe error message is returned.
  2. Check current quota utilization in the Google AI Studio or Google Cloud Console.
  3. Inspect `/admin/usage` to identify peak usage hours or high-consumption operations.

### Symptom: `GEMINI_API_KEY is not configured`
* **Root Cause:** `GEMINI_API_KEY` is missing or empty in the production `.env` file.
* **Remediation:**
  Add a valid key to `.env` and restart the container:
  ```bash
  docker restart documind
  ```

---

## 5. Admin Bootstrap Failures

### Symptom: `User not found: No user registered with email "..."`
* **Root Cause:** Running `node scripts/bootstrap-admin.mjs <email>` before the user has signed up.
* **Remediation:**
  DocuMind enforces PostgreSQL as the sole authorization source and will never fabricate phantom users. The user must first sign in via Clerk at `https://documind.yourdomain.com` so their `users` row is created. Once registered, re-run the bootstrap command.

---

## 6. Container Startup Failures

### Symptom: Container exits immediately with code 1
* **Diagnosis:**
  View the crash log:
  ```bash
  docker logs documind
  ```
* **Common Causes & Fixes:**
  * **Missing `DATABASE_URL`:** Set in `.env`.
  * **Next.js Port Conflict:** Ensure port 3000 is not already bound by another service on the host (`sudo lsof -i :3000`).
  * **Missing Production Dependencies:** Ensure `npm ci --omit=dev` ran cleanly in the Docker build.
