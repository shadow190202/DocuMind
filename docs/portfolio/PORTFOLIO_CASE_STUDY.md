# DocuMind — Engineering Case Study & Technical Portfolio Showcase

This case study details the engineering rationale, system design trade-offs, and verified outcomes behind **DocuMind — AI Document Intelligence & Knowledge Assistant**.

---

## 1. Executive Summary & Problem Statement

Organizations and professionals frequently accumulate large volumes of unstructured data across diverse document formats (PDF contracts, DOCX briefs, CSV data sheets, TXT logs). Searching this information manually is inefficient, and standard keyword search fails to capture semantic meaning or provide synthesized answers.

While commercial Retrieval-Augmented Generation (RAG) platforms address this problem, they often incur substantial monthly expenses for external vector databases (Pinecone, Weaviate), paid LLM API subscriptions (OpenAI), and managed cloud object storage (AWS S3).

**The Engineering Challenge:**  
Design, build, and deploy an enterprise-grade document intelligence platform that delivers:
1. Multi-format ingestion with physical page-level citation attribution.
2. High-precision 768-dimensional semantic vector search.
3. Grounded, hallucination-resistant question answering.
4. Granular multi-tenant permission controls and administrative telemetry.
5. Strict adherence to a **zero-cost infrastructure model** using PostgreSQL `pgvector`, Google Gemini free-tier models, and local persistent volume container storage.

---

## 2. Key Architectural Decisions & Engineering Trade-Offs

### Decision 1: PostgreSQL + `pgvector` vs. Dedicated Vector Database (Pinecone / Weaviate)
* **The Dilemma:** Dedicated vector databases provide managed vector search, but introduce an additional external service, data synchronization overhead, network latency between stores, and recurring subscription costs.
* **The Solution:** DocuMind unifies relational data and vector embeddings inside PostgreSQL 15/16 using the `pgvector` extension.
* **Engineering Trade-offs:**
  * *Advantage (Transactional Consistency):* Document chunks, user permissions, and embeddings reside in the same relational schema. When a document is deleted, foreign keys cascade deletes (`ON DELETE CASCADE`) to vector chunks atomically in a single SQL operation.
  * *Advantage (Cost):* Operates at zero marginal cost on free-tier PostgreSQL providers (e.g. Neon, Supabase) or self-hosted servers.
  * *Trade-off:* Requires explicit connection pooler resilience (`prepare: false` configured in Drizzle ORM) to prevent prepared statement errors on transaction poolers like PgBouncer.

### Decision 2: Local Persistent Volume Storage vs. Cloud Object Storage (AWS S3 / GCS)
* **The Dilemma:** Using AWS S3 or Google Cloud Storage adds cloud egress fees, IAM credential complexity, and third-party vendor lock-in.
* **The Solution:** Filesystem storage mounted to a persistent host volume (`-v /var/data/documind/storage:/app/storage`).
* **Engineering Trade-offs:**
  * *Advantage:* Zero storage subscription costs; native local filesystem read/write performance.
  * *Advantage (Security):* Path traversal attacks are mitigated locally via `safeResolvePath`, which normalizes paths, detects null bytes, decodes percent-encoded sequences, and asserts canonical boundary containment via `fs.realpathSync`.
  * *Trade-off (Serverless Ephemerality):* Serverless hosts (e.g. Vercel) provide only ephemeral `/tmp` storage. Deploying DocuMind requires a container-friendly persistent host (Linux VPS / Docker) to maintain file persistence across reboots.

### Decision 3: PostgreSQL-Authoritative Admin Authorization vs. Clerk Role Claims
* **The Dilemma:** Clerk session tokens can carry custom user metadata containing role claims (e.g., `role: "admin"`). However, when an administrator promotes or demotes a user, existing JWT sessions remain valid until token expiry, allowing demoted users to temporarily retain unauthorized privileges.
* **The Solution:** DocuMind treats Clerk solely as the identity provider (`userId`) while establishing PostgreSQL `users.role === 'admin'` as the single authoritative source of truth.
* **Engineering Trade-offs:**
  * *Advantage:* Role changes take effect immediately at the database level. Demotions instantly revoke access to `/api/admin/*` endpoints without waiting for token refresh.
  * *Advantage (Concurrency Safety):* Modifying admin roles uses `SELECT ... FOR UPDATE` row-level locks, preventing accidental self-demotion or race conditions that could demote the sole remaining administrator.
  * *Trade-off:* Requires an indexed database lookup (`users_role_idx`) on administrative requests, adding a lightweight database round-trip.

### Decision 4: Gemini Free-Tier AI & Quota Architecture
* **The Dilemma:** High-volume AI operations can rapidly exhaust provider-level free-tier quotas (HTTP 429 `RESOURCE_EXHAUSTED`).
* **The Solution:**
  1. *Model Selection:* Exclusively uses `gemini-embedding-001` (768 dimensions) for vectorization and `gemini-3.8-flash` for grounded chat, summarization, and comparisons.
  2. *Result Caching:* Document summaries and comparisons are cached in PostgreSQL (`document_summaries` and `document_comparisons`), completely eliminating repeated LLM calls for identical requests.
  3. *Application Rate Limiting:* An in-memory sliding window limits AI endpoints to 10 req/min/IP.
  4. *Exponential Backoff:* Transient provider 429 events are handled via automated retries with jitter (1s, 2s, 4s).
  5. *Offline Mock Transport Guard:* All automated test suites enforce `DOCUMIND_MOCK_AI=true`, ensuring that CI runs consume **0 live API quota**.

---

## 3. Verified Engineering Outcomes & Quality Metrics

The following metrics reflect verified repository facts and measured test outcomes:

* **100% Pure JavaScript:** Zero `.ts` or `.tsx` files; zero TypeScript compiler packages or `@types/*` dependencies.
* **576 Verified Test Checks/Assertions:** Across a 3-tier testing pyramid:
  * 38 unit assertions (parsers, chunker, validations, rate limiting, storage, errors)
  * 37 integration assertions (documents, vector cosine search, permissions, chat, admin)
  * 16 Playwright browser E2E tests (real-browser user and admin workflows)
  * 485 historical regression assertions across 9 dedicated phase suites
* **0 Residual Test Fixtures:** Authoritative database audit confirms zero orphaned test records across all 9 tables following test runs.
* **Multi-Format Ingestion Capacity:** Validated up to 20 MB for PDF, DOCX, TXT, and CSV files with deep magic-byte validation.
* **Multi-Tier Security Posture:** 13 verified defense-in-depth security layers, including CSRF protection, production-aware HSTS, strict CSP without `'unsafe-eval'`, and correlation ID tracing (`x-correlation-id`).

---

## 4. Key Takeaways for Technical Evaluators

DocuMind demonstrates that a full-stack, enterprise-grade AI document intelligence platform can be built with production rigor, verifiable security, and comprehensive test coverage—without depending on expensive SaaS subscriptions or commercial vector platforms.
