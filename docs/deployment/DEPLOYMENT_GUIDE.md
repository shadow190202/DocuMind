# DocuMind — Production Deployment Guide

This guide provides the official, step-by-step procedure for deploying **DocuMind** in production.

---

## 1. Architecture Overview

DocuMind's production deployment runs as a containerized Next.js 14 service on a Linux VPS / Cloud VM / Dedicated Server with native host persistent storage.

```
                              Internet / Users
                                     │
                             (HTTPS Port 443)
                                     ▼
                     ┌───────────────────────────────┐
                     │ Reverse Proxy (Nginx / Caddy) │
                     │   - SSL/TLS Termination       │
                     │   - HSTS & Security Headers   │
                     └───────────────┬───────────────┘
                                     │ (HTTP Port 3000)
                                     ▼
                     ┌───────────────────────────────┐
                     │   DocuMind Docker Container   │
                     │   (node:20-bookworm-slim)     │
                     │   Non-root user: nextjs       │
                     └───────┬───────────────┬───────┘
                             │               │
            Persistent Mount │               │ Managed Connections
                             ▼               ▼
         ┌─────────────────────────┐   ┌──────────────────────────────┐
         │ Host Persistent Disk    │   │ External Managed PostgreSQL  │
         │ /var/data/documind/     │   │ - pgvector (768 dimensions)  │
         │ storage/                │   │ - Neon / Supabase / Railway  │
         │  ├── documents/         │   └──────────────────────────────┘
         │  └── extracted/         │   ┌──────────────────────────────┐
         └─────────────────────────┘   │ Clerk Production Auth        │
                                       │ (pk_live_... / sk_live_...)  │
                                       └──────────────────────────────┘
                                       ┌──────────────────────────────┐
                                       │ Google Gemini Free-Tier API  │
                                       │ - gemini-embedding-001 (768) │
                                       │ - gemini-2.5-flash (chat)    │
                                       └──────────────────────────────┘
```

### Invariants & Non-Negotiables
- **100% JavaScript:** Runs directly on Node.js 20 LTS without TypeScript compilers or type-checking overhead.
- **Persistent Filesystem Storage:** Document binaries and extracted text JSON persist on the host filesystem under `/app/storage`.
- **Zero Paid AI / Database Subscriptions:** Uses Google Gemini free-tier AI and free-tier PostgreSQL with `pgvector` (Neon / Supabase).
- **PostgreSQL-Authoritative Administration:** Identity established via Clerk; administrative access strictly gated by PostgreSQL `users.role === 'admin'`.

---

## 2. Prerequisites

Before beginning deployment, ensure you have:
1. **Linux Server / VM:** Ubuntu 22.04/24.04 LTS or Debian 12 with at least 1 GB RAM, 1 vCPU, and 10 GB disk space (e.g., Oracle Cloud Always Free, Hetzner, DigitalOcean droplet, AWS EC2).
2. **Docker Engine & Compose:** Docker version 24+ installed on the host.
3. **Domain Name:** DNS `A` or `CNAME` record pointing to your server's IP address.
4. **PostgreSQL with pgvector:** Managed PostgreSQL instance (Neon, Supabase, Railway) with `vector` extension enabled.
5. **Clerk Production Account:** Clerk application with live production keys (`pk_live_...`, `sk_live_...`) and production redirect URLs configured.
6. **Google Gemini API Key:** Valid API key from Google AI Studio.

---

## 3. Host Persistent Storage Setup

DocuMind writes uploaded document binaries to `./storage/documents` and extracted JSON to `./storage/extracted`. Inside the container, this is `/app/storage`.

On your host Linux server, create the persistent storage directory and grant ownership to the container user (UID 1001 / GID 1001):

```bash
# 1. Create persistent storage directories on the host
sudo mkdir -p /var/data/documind/storage/documents
sudo mkdir -p /var/data/documind/storage/extracted

# 2. Assign ownership to UID 1001 (the 'nextjs' non-root container user)
sudo chown -R 1001:1001 /var/data/documind/storage
sudo chmod -R 750 /var/data/documind/storage
```

---

## 4. Production Environment Configuration

Create a dedicated directory for your DocuMind deployment and create a secure `.env` file:

```bash
mkdir -p /opt/documind && cd /opt/documind
nano .env
```

Populate `.env` with your production variables:

```ini
# App Configuration
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_APP_URL=https://documind.yourdomain.com

# PostgreSQL Database (Must support pgvector and SSL)
DATABASE_URL=postgresql://user:password@ep-sample-pooler.region.aws.neon.tech/documind?sslmode=require

# Clerk Production Credentials
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_REDACTED
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Google Gemini API
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Storage Subsystem
STORAGE_PROVIDER=local
```

> [!WARNING]
> **Testing Variables Must NEVER Be Set in Production:**
> Do NOT set `DOCUMIND_MOCK_AI`, `DOCUMIND_E2E_MODE`, or `DOCUMIND_E2E_SECRET` in production. Omitting them guarantees that synthetic authentication and mock transports cannot be activated.

---

## 5. Database Provisioning & Pre-Deployment Migrations

### 5.1 Verify pgvector Extension
Connect to your PostgreSQL database and confirm the vector extension is installed:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

### 5.2 Execute Pre-Deployment Migrations
Run the authoritative migration runner against your production database:

```bash
# From the cloned repository directory:
npm run db:migrate
```

This applies migrations `0000` through `0007` in sequence:
* `0000`: Core schema, pgvector 768-dimension embeddings, tables, and cascade foreign keys.
* `0001`: Chunk index column and composite index on document chunks.
* `0002`: AI usage logs table and composite index for telemetry.
* `0003`: Conversation and message history performance indexes.
* `0004`: Document summaries table with unique pair constraints.
* `0005`: Document comparisons table with pair uniqueness constraints.
* `0006`: Enhanced document permissions and deterministic deduplication.
* `0007`: Administrative indexes on user roles, document statuses, and AI telemetry.

> [!CAUTION]
> **Never use `drizzle-kit push` in production.** Always use `npm run db:migrate` (`node src/db/migrate.js`).

---

## 6. Building and Running the Docker Container

### 6.1 Build the Production Container
From the repository root on the server:

```bash
docker build -t documind:latest .
```

### 6.2 Run the Container with Persistent Storage Mount
Launch the container, binding port 3000 and mounting the persistent host storage volume:

```bash
docker run -d \
  --name documind \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /opt/documind/.env \
  -v /var/data/documind/storage:/app/storage \
  documind:latest
```

### 6.3 Verify Container Health
```bash
# Check container status
docker ps -f name=documind

# Inspect container logs
docker logs documind

# Verify minimal health check endpoint
curl -i http://127.0.0.1:3000/api/health
```

Expected health check response:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"healthy","timestamp":"2026-09-25T23:00:00.000Z"}
```

---

## 7. Reverse Proxy & SSL Configuration (Nginx Example)

Configure Nginx as a reverse proxy with automated Let's Encrypt SSL certificates:

```nginx
server {
    server_name documind.yourdomain.com;

    client_max_body_size 25M; # Supports 20 MB uploads + multipart headers

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Obtain an SSL certificate:
```bash
sudo certbot --nginx -d documind.yourdomain.com
```

---

## 8. Initial Administrator Bootstrap

DocuMind enforces administrative authorization exclusively through PostgreSQL `users.role === 'admin'`.

To bootstrap the first administrator safely:
1. Navigate to `https://documind.yourdomain.com` in your browser.
2. Sign up / sign in via Clerk with your intended administrator email (e.g., `admin@yourdomain.com`). This ensures your user account record is created in PostgreSQL.
3. Run the one-time bootstrap script from the server terminal:

```bash
node scripts/bootstrap-admin.mjs admin@yourdomain.com
```

Expected output:
```text
Connecting to database to verify user "admin@yourdomain.com"...
✅ Success: User "admin@yourdomain.com" (ID: user_2xxx) has been promoted to administrator.
   PostgreSQL authoritative authorization (users.role = 'admin') is active.
```

4. Refresh your browser; the `/admin` dashboard is now accessible.

---

## 9. Google Gemini AI Free-Tier Management

### 9.1 Active Models
* **Embeddings:** `gemini-embedding-001` with `outputDimensionality: 768`.
* **Chat, Summaries & Comparisons:** `gemini-2.5-flash`.

### 9.2 Rate Limiting vs Provider Quotas
* **Application Throttling:** DocuMind limits client requests to 10 req/min per IP on AI endpoints (`/api/chat`, `/api/summary`, `/api/compare`).
* **Google Provider Quota:** Quotas are governed and dynamically adjusted by Google Cloud. If the provider quota is reached, Google returns HTTP 429 (`RESOURCE_EXHAUSTED`).
* **Resilience:** DocuMind automatically executes up to 3 retries with exponential backoff (1s, 2s, 4s) upon transient 429 errors.
* **Quota Auditing:** Monitor cumulative token and request usage in real-time under `/admin` and `/api/admin/usage`.

---

## 10. Backup, Disaster Recovery & Rollback

### 10.1 Database Backup
Perform periodic backups of the PostgreSQL database:
```bash
pg_dump "$DATABASE_URL" -F c -b -v -f /backups/documind_db_$(date +%F).dump
```

To restore:
```bash
pg_restore -d "$DATABASE_URL" -v /backups/documind_db_2026-09-25.dump
```

### 10.2 Storage Volume Backup
Back up all uploaded and extracted documents:
```bash
sudo tar -czf /backups/documind_storage_$(date +%F).tar.gz -C /var/data/documind storage
```

### 10.3 Application Rollback
To rollback to a previous application release:
```bash
docker stop documind
docker rm documind
docker run -d \
  --name documind \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /opt/documind/.env \
  -v /var/data/documind/storage:/app/storage \
  documind:previous-tag
```
