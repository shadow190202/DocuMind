# DocuMind — Production Smoke Test Verification Checklist

This runbook defines the post-deployment verification procedures for DocuMind.

Verification is divided into two distinct categories:
1. **Automated Pre-Flight & CI Tests:** Executed locally or in CI with mocked AI to verify zero regression and zero quota consumption.
2. **Live Production Smoke Tests:** Performed manually on the production deployment to verify live services, Clerk production authentication, live Gemini API integration, and host storage persistence.

---

## 1. Automated Pre-Flight Baseline

Before deploying any release, verify that all automated suites pass:

```bash
# 1. Unit Tests (38/38)
npm run test:unit

# 2. Integration Tests (37/37)
npm run test:integration

# 3. Playwright Browser E2E Tests (16/16)
npm run test:e2e

# 4. Historical Regressions (485/485 assertions across Phases 8–15)
npm run test:regressions

# 5. Master Suite (Includes Zero-Orphan Database Audit)
npm test

# 6. Production Build
npm run build
```

**Total Verified Assertions:** **576**  
**API Quota Consumed:** **0** (offline transport guard strictly enforced).

---

## 2. Live Production Smoke Test Checklist

Execute these verification steps after launching the production container:

### Check 1: Public Health Endpoint (`/api/health`)
* **Command:** `curl -i https://documind.yourdomain.com/api/health`
* **Verification:**
  - [ ] Returns HTTP 200 OK.
  - [ ] Response body matches `{"status":"healthy","timestamp":"..."}`.
  - [ ] Strictly zero disclosure of database version, pgvector version, connection strings, filesystem paths, or internal diagnostics.

### Check 2: Production Security Headers
* **Command:** `curl -I https://documind.yourdomain.com/`
* **Verification:**
  - [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` is present.
  - [ ] `X-Frame-Options: DENY` is present.
  - [ ] `X-Content-Type-Options: nosniff` is present.
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin` is present.
  - [ ] `Content-Security-Policy` contains `https://*.clerk.com` and omits `'unsafe-eval'`.

### Check 3: Unauthenticated Route Protection
* **Action:** Open an incognito browser window and navigate to `https://documind.yourdomain.com/dashboard`.
* **Verification:**
  - [ ] User is immediately redirected to `/sign-in`.
  - [ ] Protected dashboard data is not rendered.

### Check 4: Clerk Live Production Authentication
* **Action:** Sign up or sign in using a valid user account via Clerk.
* **Verification:**
  - [ ] Authentication modal loads without CSP errors in the browser console.
  - [ ] User session is established; user is redirected to `/dashboard`.
  - [ ] A corresponding record is created in the PostgreSQL `users` table.

### Check 5: Document Upload (20 MB Limit)
* **Action:** Upload a valid PDF file (<20 MB) from the dashboard.
* **Verification:**
  - [ ] Upload completes with HTTP 200.
  - [ ] Document file is saved in `/app/storage/documents/<sanitizedUserId>/` on the persistent host volume.
  - [ ] Deep file validation succeeds (magic-byte `%PDF-` check passes).
  - [ ] Uploading a file >20 MB is rejected with HTTP 400.

### Check 6: Document Text Extraction & Storage
* **Action:** Wait for document processing to finish.
* **Verification:**
  - [ ] Document status transitions to `completed`.
  - [ ] Extracted text JSON is saved in `/app/storage/extracted/<sanitizedUserId>/<docId>.json`.
  - [ ] Document text is viewable in the UI.

### Check 7: Embeddings Generation (`gemini-embedding-001`)
* **Action:** Check database chunks for the processed document.
* **Verification:**
  - [ ] Chunks are stored in the `document_chunks` table.
  - [ ] Each chunk has an `embedding` vector of exactly 768 dimensions.

### Check 8: pgvector Similarity Search
* **Action:** Use the search bar in the dashboard to search for keywords present in the uploaded document.
* **Verification:**
  - [ ] Search query generates embedding and performs cosine distance search (`<=>`).
  - [ ] Relevant chunks are returned with high similarity scores.

### Check 9: Grounded RAG Chat (`gemini-2.5-flash`)
* **Action:** Open the document chat interface and ask a question answered by the document content.
* **Verification:**
  - [ ] Chat query returns a structured JSON answer from `gemini-2.5-flash`.
  - [ ] Response includes verified citation snippets and page number references.
  - [ ] Conversation and messages are persisted in PostgreSQL.

### Check 10: Document Summarization
* **Action:** Click "Generate Summary" on the document view.
* **Verification:**
  - [ ] Summary is generated and rendered in the UI.
  - [ ] Summary record is cached in `document_summaries`.
  - [ ] Subsequent requests for the same summary return the cached version instantly.

### Check 11: Document Comparison
* **Action:** Select two uploaded documents and request a comparison.
* **Verification:**
  - [ ] Comparison is generated and displayed.
  - [ ] Comparison record is cached in `document_comparisons`.

### Check 12: Document Sharing & Permissions
* **Action:** Share a document with another registered user with "read" permission.
* **Verification:**
  - [ ] Recipient can view the document and ask chat questions.
  - [ ] Recipient cannot edit, share, or delete the document.

### Check 13: Admin Route Authorization (Non-Admin Check)
* **Action:** Attempt to navigate to `https://documind.yourdomain.com/admin` using a standard (non-admin) account.
* **Verification:**
  - [ ] Request is forbidden; user is immediately redirected to `/dashboard`.

### Check 14: Admin Bootstrap & Admin Dashboard Access
* **Action:** On the server, run `node scripts/bootstrap-admin.mjs <your-admin-email>`. Refresh browser on `/admin`.
* **Verification:**
  - [ ] Bootstrap script updates `users.role = 'admin'` in PostgreSQL.
  - [ ] Admin dashboard loads successfully, showing user list, document stats, and system diagnostics.

### Check 15: Admin System Diagnostics (`/api/admin/system`)
* **Action:** View the System Health tab in the Admin Dashboard.
* **Verification:**
  - [ ] Database latency is measured and displayed.
  - [ ] `pgvector` version is displayed dynamically (e.g., `0.8.x`).
  - [ ] Row counts for all 9 application tables are populated.
  - [ ] Storage volume utilization is displayed.
  - [ ] Zero secrets, API keys, or connection strings are exposed.

### Check 16: AI Usage Telemetry Tracking
* **Action:** View the AI Usage tab in the Admin Dashboard.
* **Verification:**
  - [ ] All previous chat, summary, and comparison calls are recorded in `ai_usage_logs`.
  - [ ] Prompt tokens, completion tokens, and total tokens are accurately tracked.
  - [ ] Rolling 24-hour request count is displayed against current Google account limits.

### Check 17: Application Rate Limiting Burst Throttle
* **Action:** Rapidly send >10 requests within one minute to `/api/chat` from a single client.
* **Verification:**
  - [ ] Request 11 is rejected with HTTP 429 Too Many Requests.
  - [ ] `Retry-After` and `X-RateLimit-*` headers are present in the response.

### Check 18: Production Synthetic-Auth Rejection
* **Action:** Send an unauthenticated request with synthetic test headers:
  ```bash
  curl -i -H "x-e2e-user-id: user_fake_123" https://documind.yourdomain.com/api/documents
  ```
* **Verification:**
  - [ ] Request is rejected with HTTP 401 Unauthorized.
  - [ ] Synthetic auth headers are completely ignored in production.
