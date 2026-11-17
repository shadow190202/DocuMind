# DocuMind

> Document intelligence and conversational knowledge assistant with verifiable citations, powered by PostgreSQL `pgvector` and Google Gemini.

[![Live Demo](https://img.shields.io/badge/Demo-docu--mind-blue.svg)](https://docu-mind-dun.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](package.json)
[![JavaScript](https://img.shields.io/badge/JavaScript-100%25-f7df1e?logo=javascript&logoColor=black)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](package.json)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql&logoColor=white)](src/db/schema.js)

DocuMind is an open-source, full-stack document intelligence platform. Users can securely upload multi-format documents (PDF, DOCX, TXT, CSV), extract text with physical page attribution, store 768-dimensional vector embeddings, perform semantic vector similarity search via PostgreSQL `pgvector`, and engage in grounded RAG (Retrieval-Augmented Generation) chat with verifiable page citations.

---

## Key Features

- **Multi-Format Ingestion:** Parse PDF, DOCX, TXT, and CSV files up to 20 MB with binary magic-byte validation and structure extraction.
- **Accurate Page Citations:** PDF extraction retains physical page numbers, so answers link back to the exact page and paragraph.
- **pgvector Semantic Search:** Chunks are embedded into 768-dimensional vectors using `gemini-embedding-001` and queried via cosine distance (`<=>`) in PostgreSQL.
- **Grounded RAG Chat:** Gemini 1.5 Flash generates answers strictly bounded by retrieved context, returning fallback responses when confidence is low.
- **Document Summarization:** Executive, structured, and bulleted summaries powered by multi-stage map-reduce algorithms with database caching.
- **Side-by-Side Comparison:** Compare revisions or related contracts to identify shared terms, key differences, and action items.
- **Access Control & Tenant Isolation:** Strict user-scoped vector filtering, granular document sharing (`read`, `write`), and administrative health dashboards.
- **Security & Containment:** Path traversal protection (`safeResolvePath`), disguised executable detection, rate limiting, and sanitized error logging.

---

## Architecture

```mermaid
flowchart TD
    Client["Browser Client / Next.js 14"] -->|"HTTPS"| App["DocuMind App Router<br/>Node.js 20 ESM"]

    subgraph SecurityLayer["Security & Auth"]
        App -->|"Session Check"| Clerk["Clerk Auth"]
        App -->|"Role Gate"| AdminGate["PostgreSQL RBAC"]
        App -->|"Throttling"| RateLimiter["Sliding-Window Rate Limiter"]
    end

    subgraph DataStorage["Storage & Indexing"]
        App -->|"Local Files"| Storage["Persistent Disk<br/>storage/documents & storage/extracted"]
        App -->|"Drizzle ORM"| DB["PostgreSQL 16 + pgvector<br/>Documents, Chunks (768d), Users, Messages"]
    end

    subgraph AIService["AI & Embeddings"]
        App -->|"Embeddings"| GeminiEmbed["gemini-embedding-001 (768d)"]
        App -->|"Grounded Q&A"| GeminiChat["gemini-1.5-flash"]
    end
```

---

## Tech Stack

| Layer | Technologies | Details |
| :--- | :--- | :--- |
| **Runtime & Framework** | Node.js 20 LTS, Next.js 14 (App Router) | 100% JavaScript (ES modules) |
| **Database & ORM** | PostgreSQL with `pgvector`, Drizzle ORM | 768-dimensional cosine vector indexing |
| **AI Models** | Google Gemini API (`@google/genai`) | `gemini-embedding-001`, `gemini-1.5-flash` |
| **Authentication** | Clerk (`@clerk/nextjs`) | Session tokens, user management, and DB sync |
| **Document Parsers** | `pdf-parse`, `mammoth`, `csv-parse` | Multi-format extraction with page attribution |
| **Testing** | Node test runner, Playwright | Offline mock guard, zero-orphan database audit |
| **Deployment** | Docker | Multi-stage build, unprivileged user |

---

## Getting Started

### Prerequisites

- **Node.js:** `v20.x` or later
- **PostgreSQL:** `v15` or `v16` with the `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`)
- **Clerk Account:** Free API keys from [clerk.com](https://clerk.com)
- **Google Gemini API Key:** From [Google AI Studio](https://aistudio.google.com/)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/documind.git
cd documind

# 2. Install dependencies
npm install

# 3. Create environment configuration
cp .env.example .env.local
```

### Environment Configuration

Configure your `.env.local` file:

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

### Database Migrations

Apply database migrations:

```bash
npm run db:migrate
```

### Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open the application.

---

## Testing

DocuMind includes a testing pipeline with an offline mock guard ensuring test runs consume **zero Gemini API quota**:

```bash
# Run unit tests (offline, fast logic & security checks)
npm run test:unit

# Run API & database integration tests
npm run test:integration

# Run browser E2E tests via Playwright
npm run test:e2e

# Run complete test suite
npm test
```

---

## Production Deployment (Docker)

```bash
# Build production Docker image
docker build -t documind:latest .

# Run with persistent storage volume
docker run -d \
  --name documind \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  -v /var/data/documind/storage:/app/storage \
  documind:latest
```

---

## Documentation

- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)
- [Database Schema & ERD](docs/architecture/DATABASE_SCHEMA.md)
- [API Reference](docs/api/API_REFERENCE.md)
- [Security Model](docs/security/SECURITY_MODEL.md)
- [Testing Strategy](docs/testing/TESTING_STRATEGY.md)
- [Production Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)
- [Troubleshooting Manual](docs/deployment/TROUBLESHOOTING.md)

---

## License

This project is licensed under the [MIT License](package.json).
