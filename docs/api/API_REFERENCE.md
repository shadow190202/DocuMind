# DocuMind — REST API Contract & Specification

This document provides the exhaustive specification for all **30 route files** and **37 distinct HTTP endpoint operations** implemented in DocuMind under `src/app/api/`.

---

## 1. Global Conventions & Standards

* **Base URL:** `https://yourdomain.com/api` (or `http://localhost:3000/api` in development).
* **Payload Format:** JSON (`Content-Type: application/json; charset=utf-8`) unless multipart/form-data is specified (e.g. document uploads).
* **Authentication:** Handled via Clerk session tokens passed in HTTP cookies or authorization headers.
* **Correlation Request ID:** Every response includes the `x-correlation-id` header (UUIDv4) to enable end-to-end distributed tracing across client requests and server console logs.
* **Standard Error Response Format:**
  ```json
  {
    "error": "Short error title",
    "message": "Client-safe descriptive message",
    "code": "ERROR_CODE_STRING",
    "requestId": "4d1667eb-0797-40c6-aa8c-843818e3923c"
  }
  ```
* **Rate Limiting Headers (RFC 6585):** Applied to AI endpoints (10 req/min/IP) and general endpoints (60 req/min/IP):
  * `X-RateLimit-Limit`: Maximum requests permitted per sliding window.
  * `X-RateLimit-Remaining`: Requests remaining in current budget.
  * `X-RateLimit-Reset`: Epoch timestamp when budget resets.
  * `Retry-After`: Seconds to wait when HTTP 429 is returned.

---

## 2. Public Health Endpoint (1 Route, 1 Operation)

### `GET /api/health`
* **Route File:** `src/app/api/health/route.js`
* **Access:** Public (no authentication required).
* **Rate Limit:** General tier (60 req/min).
* **Purpose:** Minimal liveness probe for Docker container healthchecks, cloud load balancers, and uptime monitors.
* **Security Guard:** Strictly zero disclosure of database version, pgvector version, connection strings, filesystem paths, or internal diagnostics.
* **Response (HTTP 200):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-29T12:00:00.000Z"
  }
  ```

---

## 3. Documents & Ingestion Endpoints (12 Files, 18 Operations)

### `GET /api/documents`
* **Route File:** `src/app/api/documents/route.js`
* **Access:** Authenticated Clerk user.
* **Query Parameters:** `page` (optional integer), `limit` (optional integer), `status` (optional string).
* **Response (HTTP 200):**
  ```json
  {
    "success": true,
    "documents": [
      {
        "id": "3f1e9a42-9a41-4c40-9a25-e51c8901b0f1",
        "userId": "user_2tQ...",
        "filename": "quarterly_report.pdf",
        "fileType": "pdf",
        "fileSize": 1048576,
        "processingStatus": "completed",
        "errorMessage": null,
        "createdAt": "2026-09-29T10:00:00.000Z",
        "updatedAt": "2026-09-29T10:05:00.000Z"
      }
    ]
  }
  ```

### `POST /api/documents/upload`
* **Route File:** `src/app/api/documents/upload/route.js`
* **Access:** Authenticated Clerk user.
* **Content-Type:** `multipart/form-data`
* **Form Field:** `file` (binary buffer, max 20,971,520 bytes / 20 MB).
* **Validation:** Magic bytes inspection for PDF (`%PDF-`), DOCX (`PK\x03\x04`), TXT, CSV. Rejects Windows PE/ELF/Mach-O executables.
* **Response (HTTP 201):**
  ```json
  {
    "success": true,
    "document": {
      "id": "3f1e9a42-9a41-4c40-9a25-e51c8901b0f1",
      "filename": "quarterly_report.pdf",
      "fileType": "pdf",
      "fileSize": 1048576,
      "processingStatus": "pending"
    }
  }
  ```

### `GET /api/documents/:id`
* **Route File:** `src/app/api/documents/[id]/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **IDOR Defense:** Returns HTTP 404 if the document does not exist or user lacks access.
* **Response (HTTP 200):** Client-safe document record (strips internal `storageUrl`).

### `DELETE /api/documents/:id`
* **Route File:** `src/app/api/documents/[id]/route.js`
* **Access:** Document owner only.
* **Behavior:** Cascades unlinks to local filesystem files (`deleteFile`, `deleteExtractedData`) and cascades database deletions to chunks, summaries, comparisons, and permissions.
* **Response (HTTP 200):** `{"success": true, "message": "Document deleted successfully."}`

### `POST /api/documents/:id/process`
* **Route File:** `src/app/api/documents/[id]/process/route.js`
* **Access:** Document owner or collaborator with `write` permission.
* **Behavior:** Triggers multi-format extraction, hierarchical semantic chunking, batch vector generation via `gemini-embedding-001`, and transactional persistence in `document_chunks`.
* **Response (HTTP 200):**
  ```json
  {
    "success": true,
    "documentId": "3f1e9a42-9a41-4c40-9a25-e51c8901b0f1",
    "chunksCount": 14,
    "status": "completed"
  }
  ```

### `GET /api/documents/:id/text`
* **Route File:** `src/app/api/documents/[id]/text/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **Response (HTTP 200):** Extracted text JSON from `/app/storage/extracted/<userId>/<docId>.json`.

### `GET /api/documents/:id/chunks`
* **Route File:** `src/app/api/documents/[id]/chunks/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **Response (HTTP 200):** Returns array of chunk objects containing `chunkIndex`, `pageNumber`, content preview, and vector dimensionality (`768`).

### `POST /api/documents/:id/search`
* **Route File:** `src/app/api/documents/[id]/search/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **Rate Limit:** AI Tier (10 req/min/IP).
* **Body:** `{"query": "string", "topK": 5, "threshold": 0.5}`.
* **Response (HTTP 200):** Scoped vector search results matching chunks inside this specific document.

### `POST /api/documents/:id/summarize`
* **Route File:** `src/app/api/documents/[id]/summarize/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **Rate Limit:** AI Tier (10 req/min/IP).
* **Body:** `{"summaryType": "executive" | "bullet" | "key_takeaways"}`.
* **Response (HTTP 200):** Generates (or returns cached) summary text and structured key points.

### `GET /api/documents/:id/summary`
* **Route File:** `src/app/api/documents/[id]/summary/route.js`
* **Access:** Owner or collaborator (`read`/`write`/`admin`).
* **Query:** `?type=executive`.
* **Response (HTTP 200):** Returns cached summary record from `document_summaries`.

### `GET /api/documents/:id/permissions`
* **Route File:** `src/app/api/documents/[id]/permissions/route.js`
* **Access:** Document owner only.
* **Response (HTTP 200):** List of collaborators, their emails, permission IDs, and access roles (`read`, `write`, `admin`).

### `POST /api/documents/:id/permissions`
* **Route File:** `src/app/api/documents/[id]/permissions/route.js`
* **Access:** Document owner only.
* **Body:** `{"email": "collaborator@example.com", "permission": "read" | "write"}`.
* **Response (HTTP 201):** Created permission record.

### `PATCH /api/documents/:id/permissions/:permissionId`
* **Route File:** `src/app/api/documents/[id]/permissions/[permissionId]/route.js`
* **Access:** Document owner only.
* **Body:** `{"permission": "read" | "write"}`.
* **Response (HTTP 200):** Updated permission record.

### `DELETE /api/documents/:id/permissions/:permissionId`
* **Route File:** `src/app/api/documents/[id]/permissions/[permissionId]/route.js`
* **Access:** Document owner only.
* **Response (HTTP 200):** `{"success": true, "message": "Permission revoked."}`

### `POST /api/documents/:id/share`
* **Route File:** `src/app/api/documents/[id]/share/route.js`
* **Implementation:** Compatibility alias re-exporting `POST /api/documents/:id/permissions`.

---

## 4. Multi-Document Comparison Endpoints (2 Files, 4 Operations)

### `POST /api/documents/compare`
* **Route File:** `src/app/api/documents/compare/route.js`
* **Access:** Caller must have verified read access to both documents (`verifyDualDocumentAccess`).
* **Rate Limit:** AI Tier (10 req/min/IP).
* **Body:** `{"sourceDocumentId": "uuid", "targetDocumentId": "uuid"}`.
* **Validation:** Rejects comparing a document to itself.
* **Response (HTTP 200):** Comparative markdown, structured similarities, differences, and recommendations.

### `GET /api/documents/compare`
* **Route File:** `src/app/api/documents/compare/route.js`
* **Access:** Authenticated user.
* **Response (HTTP 200):** List of cached comparisons requested by the user.

### `GET /api/documents/compare/:id`
* **Route File:** `src/app/api/documents/compare/[id]/route.js`
* **Access:** User with read access to both referenced documents.
* **Response (HTTP 200):** Cached comparison record from `document_comparisons`.

### `DELETE /api/documents/compare/:id`
* **Route File:** `src/app/api/documents/compare/[id]/route.js`
* **Access:** User who initiated the comparison.
* **Response (HTTP 200):** `{"success": true, "message": "Comparison deleted."}`

---

## 5. Vector Search & Grounded Chat Endpoints (4 Files, 7 Operations)

### `POST /api/search`
* **Route File:** `src/app/api/search/route.js`
* **Access:** Authenticated user.
* **Rate Limit:** General Tier (60 req/min).
* **Body:**
  ```json
  {
    "query": "financial risk assessment",
    "topK": 5,
    "threshold": 0.5,
    "documentIds": ["uuid1", "uuid2"],
    "includeContext": true
  }
  ```
* **Response (HTTP 200):** Scored chunk passages with similarity score, page number, and aggregated context string.

### `POST /api/chat`
* **Route File:** `src/app/api/chat/route.js`
* **Access:** Authenticated user with read access to the target document.
* **Rate Limit:** AI Tier (10 req/min/IP).
* **Body:**
  ```json
  {
    "question": "What were the total liabilities in Q3?",
    "documentId": "3f1e9a42-9a41-4c40-9a25-e51c8901b0f1",
    "conversationId": "optional-uuid"
  }
  ```
* **Response (HTTP 200):**
  ```json
  {
    "success": true,
    "conversationId": "e2a1b41c-...",
    "userMessageId": "7c8b9d0e-...",
    "assistantMessageId": "1f2e3d4c-...",
    "question": "What were the total liabilities in Q3?",
    "answer": "Total liabilities reported for Q3 were $4.2M.",
    "sources": [
      {
        "chunkId": "9b8a7c6d-...",
        "pageNumber": 12,
        "contentSnippet": "...liabilities as of September 30 totaled $4.2M..."
      }
    ],
    "usage": {
      "promptTokens": 1420,
      "completionTokens": 38,
      "totalTokens": 1458
    }
  }
  ```

### `GET /api/conversations`
* **Route File:** `src/app/api/conversations/route.js`
* **Access:** Authenticated user.
* **Response (HTTP 200):** List of user conversation sessions ordered by `updatedAt DESC`.

### `GET /api/conversations/:id`
* **Route File:** `src/app/api/conversations/[id]/route.js`
* **Access:** Conversation owner only.
* **Response (HTTP 200):** Conversation details and chronological list of messages with citations.

### `PATCH /api/conversations/:id`
* **Route File:** `src/app/api/conversations/[id]/route.js`
* **Access:** Conversation owner only.
* **Body:** `{"title": "Updated Title"}`.
* **Response (HTTP 200):** Updated conversation record.

### `DELETE /api/conversations/:id`
* **Route File:** `src/app/api/conversations/[id]/route.js`
* **Access:** Conversation owner only.
* **Response (HTTP 200):** `{"success": true, "message": "Conversation deleted."}`

### `GET /api/conversations/:id/export`
* **Route File:** `src/app/api/conversations/[id]/export/route.js`
* **Access:** Conversation owner only.
* **Query:** `?format=json` or `?format=markdown`.
* **Response (HTTP 200):** Downloadable formatted transcript.

---

## 6. Usage Telemetry Endpoint (1 File, 1 Operation)

### `GET /api/usage`
* **Route File:** `src/app/api/usage/route.js`
* **Access:** Authenticated user.
* **Response (HTTP 200):** Aggregated token consumption, operation breakdown (`chat`, `summarize`, `compare`), and recent request logs.

---

## 7. Administrator Operations & Diagnostics Endpoints (6 Files, 9 Operations)

> [!IMPORTANT]
> All `/api/admin/*` endpoints strictly require that PostgreSQL `users.role === 'admin'` for the authenticated user ID. Unauthorized callers receive `HTTP 403 Forbidden`.

### `GET /api/admin/stats`
* **Route File:** `src/app/api/admin/stats/route.js`
* **Query:** `?timeRange=24h | 7d | 30d | all`.
* **Response (HTTP 200):** Platform KPIs: total users, total documents, total questions asked, total tokens consumed, active users count.

### `GET /api/admin/users`
* **Route File:** `src/app/api/admin/users/route.js`
* **Query:** `?page=1&limit=20&search=email&role=all`.
* **Response (HTTP 200):** Paginated user directory with aggregated upload counts and token usage.

### `PATCH /api/admin/users/:id`
* **Route File:** `src/app/api/admin/users/[id]/route.js`
* **Body:** `{"role": "user" | "admin"}`.
* **Concurrency Guard:** Uses `SELECT ... FOR UPDATE` to block self-demotion or demoting the last remaining active administrator in the database.
* **Response (HTTP 200):** Updated user record.

### `GET /api/admin/documents`
* **Route File:** `src/app/api/admin/documents/route.js`
* **Response (HTTP 200):** System-wide document listing with user metadata and processing statuses.

### `DELETE /api/admin/documents/:id`
* **Route File:** `src/app/api/admin/documents/[id]/route.js`
* **Response (HTTP 200):** Admin deletion of any document with full cascade cleanup.

### `POST /api/admin/documents/:id/reprocess`
* **Route File:** `src/app/api/admin/documents/[id]/reprocess/route.js`
* **Response (HTTP 200):** Forces document re-extraction, semantic chunk replacement, and cache invalidation.

### `GET /api/admin/processing`
* **Route File:** `src/app/api/admin/processing/route.js`
* **Response (HTTP 200):** Processing queue telemetry, pending jobs, and failure rates.

### `GET /api/admin/usage`
* **Route File:** `src/app/api/admin/usage/route.js`
* **Response (HTTP 200):** Platform-wide AI token consumption by model, hourly usage distribution, and top operations.

### `GET /api/admin/system`
* **Route File:** `src/app/api/admin/system/route.js`
* **Response (HTTP 200):**
  * Live PostgreSQL ping latency (ms).
  * Dynamic `pgvector` version query (`SELECT extversion FROM pg_extension WHERE extname = 'vector'`).
  * Total disk storage size calculated from documents table.
  * Exact row counts for all 9 application tables.
  * Sanitized environment presence flags (boolean flags only; zero secrets exposed).
