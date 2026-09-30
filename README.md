# DocuMind — AI Document Intelligence & Knowledge Assistant

* [Check here](https://docu-mind-dun.vercel.app/)

[![JavaScript](https://img.shields.io/badge/JavaScript-100%25-f7df1e?logo=javascript&logoColor=black)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black?logo=next.js)](package.json)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector_(768d)-336791?logo=postgresql&logoColor=white)](src/db/schema.js)
[![AI Engine](https://img.shields.io/badge/Gemini_Free--Tier-gemini--2.5--flash-4285f4?logo=google&logoColor=white)](src/lib/ai/gemini.js)
[![Authentication](https://img.shields.io/badge/Auth-Clerk-6c47ff?logo=clerk&logoColor=white)](src/middleware.js)
[![Tests](https://img.shields.io/badge/Test_Checks-576_Verified-success)](scripts/run-all-tests.mjs)
[![Docker](https://img.shields.io/badge/Deployment-Docker_(Node_20_Slim)-2496ed?logo=docker&logoColor=white)](Dockerfile)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](package.json)

**DocuMind** is a full-stack, enterprise-grade document intelligence platform and conversational knowledge assistant. It enables users to securely upload multi-format documents (PDF, DOCX, TXT, CSV), extract text with physical page attribution, generate 768-dimensional vector embeddings, perform semantic vector similarity search via PostgreSQL `pgvector`, and engage in grounded RAG (Retrieval-Augmented Generation) chat with verifiable page citations.

Built with a strict **100% JavaScript** codebase, DocuMind operates entirely on **Google Gemini free-tier AI** and open-source infrastructure—requiring zero external AI subscriptions or paid vector database services.

---

## Architecture Overview

```mermaid
flowchart TD
    Client["Browser Client / Next.js 14 UI"] -->|"HTTPS Port 443"| Proxy["Reverse Proxy: Nginx or Cloudflare"]
    Proxy -->|"HTTP Port 3000"| App["DocuMind Next.js 14 App Router<br/>Docker: node:20-bookworm-slim"]

    subgraph AuthGate["Authentication and Security Gates"]
        App -->|"Verify Session"| Clerk["Clerk Authentication Provider"]
        App -->|"Authorize Admin / users.role"| PGLock["PostgreSQL Admin Gate"]
        App -->|"Sliding Window Throttling"| Limiter["In-Memory Rate Limiter<br/>10 requests/min/IP"]
    end

    subgraph DataStorage["Storage and Database Subsystem"]
        App -->|"File and JSON Storage"| LocalDisk["Persistent Storage<br/>/app/storage<br/>documents: Raw Files<br/>extracted: Parsed JSON"]
        App -->|"Drizzle ORM / SQL"| PG["PostgreSQL 18.6 with pgvector<br/>Users and Documents<br/>Document Chunks: 768d Vector<br/>Conversations and Messages<br/>AI Usage Logs<br/>Summaries and Comparisons"]
    end

    subgraph AIProcessing["Google Gemini Services"]
        App -->|"768-dimensional Embeddings"| EmbedAPI["gemini-embedding-001<br/>Output Dimension: 768"]
        App -->|"Grounded Q&A and Analysis"| ChatAPI["gemini-2.5-flash<br/>RAG Chat, Summaries, Comparison"]
    end
```

## Core Features

* **Multi-Format Document Ingestion:** Supports PDF, DOCX, TXT, and CSV up to 20 MB with deep binary magic-byte validation and disguised executable detection.
* **Accurate Page-Level Citation:** PDF text extraction preserves genuine physical page numbers, enabling grounded answers with verifiable page references.
* **Semantic Vector Search:** Chunk embeddings generated using `gemini-embedding-001` (768 dimensions) and indexed using PostgreSQL `pgvector` cosine distance (`<=>`).
* **Hallucination-Resistant Grounded Chat:** Powered by `gemini-3.8-flash` with token-budgeted context assembly and fallback messaging when context is insufficient.
* **Document Summarization:** Generates structured executive, bullet-point, and key-takeaway summaries with database caching to eliminate redundant AI calls.
* **Side-by-Side Document Comparison:** Analyzes two documents to extract structured similarities, key differences, and actionable recommendations.
* **Granular Document Sharing & Permissions:** Role-based access (`read`, `write`, `admin`) per document with IDOR prevention returning uniform 404 responses.
* **Authoritative Administrator Dashboard:** Server-side admin verification via PostgreSQL `users.role === 'admin'`, user directory management, concurrency-safe last-admin protection, document processing queue monitoring, and real-time AI token telemetry.
* **Phase 15 Security Hardening:** Comprehensive defense-in-depth including directory traversal defense (`safeResolvePath`), symlink escape protection, CSRF origin verification, HSTS over HTTPS, and centralized error masking with correlation IDs (`x-correlation-id`).
* **3-Tier Testing Pyramid (576 Verified Checks):** 38 unit assertions, 37 integration assertions, 16 Playwright browser E2E tests, 485 historical regression assertions across 9 suites, and an automated zero-orphan database audit.

---

## Technology Stack

| Layer                        | Technologies                                | Version / Specification                                                     |
| :--------------------------- | :------------------------------------------ | :-------------------------------------------------------------------------- |
| **Language & Runtime** | JavaScript (Node.js 20 LTS)                 | 100% JS (`.js`, `.jsx`, `.mjs`); Zero TypeScript                      |
| **Frontend**           | Next.js App Router, React, Tailwind CSS     | Next.js`14.2.35`, React `18.3.1`, Tailwind `3.4.14`                   |
| **Database & ORM**     | PostgreSQL with`pgvector`, Drizzle ORM    | `postgres: ^3.4.9`, `drizzle-orm: ^0.45.3`                              |
| **Vector Dimension**   | pgvector 768-dimensional cosine index       | `vector(768)` matching `gemini-embedding-001`                           |
| **AI Models**          | Google Gemini Free Tier (`@google/genai`) | `gemini-embedding-001` (Embeddings), `gemini-3.8-flash` (Chat/Analysis) |
| **Authentication**     | Clerk (`@clerk/nextjs`)                   | Clerk`^6.39.7` + PostgreSQL authoritative role check                      |
| **Document Parsers**   | `pdf-parse`, `mammoth`, `csv-parse`   | Ingestion for PDF, DOCX, TXT, CSV                                           |
| **Testing**            | Playwright, Custom ESM Test Orchestrators   | `@playwright/test: ^1.63.0`, 576 verified checks                          |
| **Containerization**   | Docker Multi-Stage Build                    | `node:20-bookworm-slim`, unprivileged user `nextjs` (UID 1001)          |

---

## Quick Start (Local Development)

### 1. Prerequisites

* **Node.js:** `v20.x` LTS or later
* **PostgreSQL:** `v15` or `v16` with the `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)
* **Clerk Account:** Free account from [Clerk.com](https://clerk.com) (Publishable & Secret Keys)
* **Google Gemini API Key:** Free key from [Google AI Studio](https://aistudio.google.com/)

### 2. Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/documind.git
cd documind

# 2. Install dependencies (100% JavaScript)
npm install

# 3. Configure environment variables
cp .env.example .env.local
```

### 3. Configure `.env.local`

Open `.env.local` and provide your credentials:

```ini
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/documind
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
STORAGE_PROVIDER=local
```

### 4. Database Migrations

Apply the forward-only Drizzle migrations (0000–0007):

```bash
npm run db:migrate
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Quality Assurance

DocuMind enforces automated quality gates with a strict offline mock transport guard—guaranteeing that test runs consume **0 Google Gemini API quota**.

```bash
# Run all unit tests (38 assertions)
npm run test:unit

# Run all database & API integration tests (37 assertions + zero-orphan audit)
npm run test:integration

# Run real browser E2E tests via Playwright (16 tests)
npm run test:e2e

# Run historical regressions across Phases 8–15 (485 assertions)
npm run test:regressions

# Run master test suite (Unit + Integration + Regressions + Zero-Orphan Audit)
npm test

# Run full test suite including Playwright browser E2E tests
npm run test:all
```

**Verified Test Baseline:** **576 verified checks/assertions** passing with 100% green status.

---

## Production Deployment (Docker on Linux VPS)

DocuMind deploys as a standalone container with a persistent volume mounted at `/app/storage`:

```bash
# 1. Build the production Docker image
docker build -t documind:latest .

# 2. Run the container with persistent storage
docker run -d \
  --name documind \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/documind/.env \
  -v /var/data/documind/storage:/app/storage \
  documind:latest

# 3. Verify health
curl http://localhost:3000/api/health
# Returns: {"status":"healthy","timestamp":"..."}
```

For full setup instructions, reverse proxy configuration, and admin bootstrapping, see the [Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md).

---

## Documentation Index

Explore the complete technical documentation suite:

| Documentation Guide                                                         | Description                                                                                             |
| :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| [**System Architecture**](docs/architecture/SYSTEM_ARCHITECTURE.md)    | End-to-end component architecture, ingestion and RAG retrieval pipelines, and storage containment.      |
| [**Database Schema & ERD**](docs/architecture/DATABASE_SCHEMA.md)      | Full 9-table schema dictionary, foreign key cascades, pgvector 768d indexes, and migration history.     |
| [**API Reference Contract**](docs/api/API_REFERENCE.md)                | Exhaustive OpenAPI-style reference covering all 30 route files and 37 HTTP endpoint operations.         |
| [**Security Model & Manifesto**](docs/security/SECURITY_MODEL.md)      | 13 hardened security layers, path traversal defenses, synthetic auth isolation, and threat mitigations. |
| [**Testing Strategy & Pyramid**](docs/testing/TESTING_STRATEGY.md)     | 3-tier testing pyramid (576 verified checks), offline mock transport guard, and zero-orphan audits.     |
| [**Portfolio Case Study**](docs/portfolio/PORTFOLIO_CASE_STUDY.md)     | Technical case study detailing architectural trade-offs, engineering challenges, and verified outcomes. |
| [**Demo Walkthrough Script**](docs/portfolio/DEMO_WALKTHROUGH.md)      | Step-by-step 10-scenario script for live demonstrations, recruiter evaluations, and video walkthroughs. |
| [**Production Deployment Guide**](docs/deployment/DEPLOYMENT_GUIDE.md) | Production setup guide for Linux VPS, persistent host volumes, pre-deployment migrations, and Nginx.    |
| [**Smoke Test Checklist**](docs/deployment/SMOKE_TEST_CHECKLIST.md)    | 18-point post-deployment manual and automated verification runbook.                                     |
| [**Troubleshooting Manual**](docs/deployment/TROUBLESHOOTING.md)       | Operational remediation manual for pgvector, storage permissions, Clerk CSP, and rate limiting.         |

---

## License

This project is licensed under the MIT License — see [package.json](package.json) for details.
