# DocuMind — Security Architecture, Threat Model & Defense In Depth

This document details DocuMind's multi-layered security architecture, implemented defense mechanisms, access control models, and production containment strategies.

---

## 1. The 13 Hardened Security Layers (Phase 15 Verification)

DocuMind enforces a defense-in-depth model across 13 distinct security controls:

### Layer 1: 20 MB File Size Boundary
* **Mechanism:** Document uploads enforce a strict 20 MB ceiling (`MAX_FILE_SIZE = 20 * 1024 * 1024` bytes) validated in both Zod schemas (`fileUploadSchema`) and raw buffer inspections (`validateDocumentBuffer`).
* **Threat Mitigated:** Denial of Service (DoS) via memory exhaustion or storage disk saturation.

### Layer 2: Deep Binary Magic-Byte Inspection
* **Mechanism:** Rather than trusting client-supplied file extensions or `Content-Type` headers, `validateDocumentBuffer` directly inspects the initial bytes of uploaded file buffers:
  * **PDF:** Asserts initial buffer bytes match `%PDF-`.
  * **DOCX:** Asserts initial buffer bytes match `PK\x03\x04` and verifies the presence of `[Content_Types].xml` or `word/` directory entries.
  * **TXT:** Validates UTF-8 encoding and asserts zero binary null bytes (`\0`).
  * **CSV:** Validates parseable tabular structure (including single-column CSVs) and rejects null-byte injections.
* **Threat Mitigated:** Disguised executables (Windows PE `MZ`, Linux ELF `\x7fELF`, Mach-O binaries) disguised as legitimate documents.

### Layer 3: Storage Path Containment (`safeResolvePath`)
* **Mechanism:** Filesystem paths are processed through `safeResolvePath(rootDir, relativePath)`:
  * Normalizes the root directory via `path.resolve(rootDir)`.
  * Resolves the target path via `path.resolve(normalizedRoot, relativePath)`.
  * Asserts that `resolvedPath.startsWith(normalizedRoot + path.sep)`.
* **Threat Mitigated:** Directory traversal attacks (`../`, `..\`, `%2e%2e/`, `%252e%252e/`) attempting to escape into system directories.

### Layer 4: Symlink Escape Verification
* **Mechanism:** If a target path exists on disk, `safeResolvePath` resolves the canonical path via `fs.realpathSync(resolvedPath)` and verifies that it remains inside `fs.realpathSync(normalizedRoot)`.
* **Threat Mitigated:** Symlink-based jailbreak attacks pointing to host sensitive files (e.g. `/etc/passwd`).

### Layer 5: URL-Decoding Attack Defense & Null-Byte Rejection
* **Mechanism:** Storage paths reject null-byte injections (`\0` and `%00`). Relative paths are safely decoded inside a `try/catch` block; malformed percent-encoded sequences are rejected immediately.
* **Threat Mitigated:** Poison null-byte bypasses and URL-encoded filter evasion.

### Layer 6: CSRF Origin Assertion (`assertValidOrigin`)
* **Mechanism:** Mutative API route handlers (`POST`, `PATCH`, `DELETE`) assert that the incoming request's `Origin` or `Referer` header matches the application's base URL (`NEXT_PUBLIC_APP_URL` or `host`).
* **Threat Mitigated:** Cross-Site Request Forgery (CSRF) attacks originating from malicious third-party websites.

### Layer 7: In-Memory Sliding-Window Rate Limiting
* **Mechanism:** `src/lib/rate-limiter.js` tracks request timestamps in an in-memory sliding window:
  * **AI Operations:** 10 requests per minute per IP (`/api/chat`, `/api/summary`, `/api/compare`).
  * **General Operations:** 60 requests per minute per IP.
  * Applies standard `X-RateLimit-*` and `Retry-After` headers upon limit violation.
* **Threat Mitigated:** Client request flooding, automated scraping, and local compute starvation.

### Layer 8: Production Content Security Policy (CSP)
* **Mechanism:** Configured in `next.config.mjs`:
  * Production omits `'unsafe-eval'`.
  * `default-src 'self'`.
  * `script-src` restricted to `'self' 'unsafe-inline' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev`.
  * `connect-src` restricted to `'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://generativelanguage.googleapis.com`.
  * `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`.
* **Threat Mitigated:** Cross-Site Scripting (XSS), clickjacking, and unauthorized third-party script injection.

### Layer 9: Production-Aware HSTS
* **Mechanism:** `src/middleware.js` inspects `NODE_ENV === 'production'` and HTTPS detection (`x-forwarded-proto === 'https'`). When true, injects:
  `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
* **Threat Mitigated:** SSL stripping and man-in-the-middle (MITM) downgrade attacks.

### Layer 10: Centralized Error Masking (`handleApiError`)
* **Mechanism:** Unexpected server exceptions (HTTP 500) are sanitized:
  * Stack traces, database connection strings, passwords, and server filesystem paths are logged exclusively to the server console.
  * The client receives a generic message (`"An unexpected error occurred."`) and an opaque reference identifier (`err_<timestamp>_<random>`).
* **Threat Mitigated:** Information disclosure and infrastructure reconnaissance.

### Layer 11: Correlation Request Tracing (`x-correlation-id`)
* **Mechanism:** Every incoming request receives or generates a unique UUIDv4 correlation ID attached to response headers (`x-correlation-id`) and prepended to server console logs.
* **Threat Mitigated:** Obscured audit trails and untraceable security incidents.

### Layer 12: Multi-Tenant Data Isolation & IDOR Defense
* **Mechanism:** All document access queries verify ownership or collaborator records. Unauthorized or nonexistent documents return an identical HTTP 404 response.
* **Threat Mitigated:** Insecure Direct Object References (IDOR) and resource enumeration attacks.

### Layer 13: Authoritative Database Admin Authorization
* **Mechanism:** Administrative endpoints (`/api/admin/*`) query PostgreSQL directly (`users.role === 'admin'`).
* **Threat Mitigated:** Privilege escalation via stale JWT claims or spoofed role metadata.

---

## 2. Synthetic E2E Authentication Mechanism & Production Isolation

DocuMind uses a controlled synthetic authentication bypass strictly for local Playwright automated testing without requiring live Clerk production accounts.

### 2.1 The Implementation Mechanism
* In `src/lib/auth/session.js` and `src/middleware.js`, the synthetic authentication path evaluates the following guard:
  ```javascript
  if (
    process.env.DOCUMIND_E2E_MODE === "enabled" &&
    process.env.DOCUMIND_E2E_SECRET &&
    process.env.DOCUMIND_E2E_SECRET.length >= 16
  ) {
    const e2eSession = await parseE2ETestSession(req);
    // Resolves identity from HMAC-signed session cookie (__documind_e2e_session)
  }
  ```

### 2.2 Production Isolation & Inactivity
* **Production Environment Configuration:** In production deployment environments (and `.env.example`), `DOCUMIND_E2E_MODE` and `DOCUMIND_E2E_SECRET` are strictly omitted.
* **Unactivated State:** When `process.env.DOCUMIND_E2E_MODE` is undefined, the synthetic bypass block does not execute.
* **Fallback Behavior:** All incoming requests strictly fall back to Clerk's authoritative `auth()` validation. Any request presenting synthetic headers (`x-e2e-user-id`) or forged test cookies is ignored by the application logic and evaluated as an unauthenticated request by Clerk, returning HTTP 401 Unauthorized.
* **Automated Verification:** Verified by regression test suites (`security-phase15.test.mjs` and Playwright `auth-navigation.spec.js`), which confirm that synthetic headers are rejected in non-test modes.

---

## 3. Google Gemini Free-Tier Credential & Quota Security

* **Server-Side Confinement:** The `GEMINI_API_KEY` is strictly a server-only environment variable. It is never prefixed with `NEXT_PUBLIC_` and is never bundled into client-side JavaScript.
* **Provider Quota Distinction:**
  $$\text{Application Rate Limiting (10 req/min/IP)} \neq \text{Google Provider Quota}$$
  The application limiter throttles client bursts locally. However, aggregate traffic across all users can reach Google's provider-controlled free-tier limits.
* **Transient Error Handling:** On HTTP 429 (`RESOURCE_EXHAUSTED`), `src/lib/ai/gemini.js` executes exponential backoff retries with jitter (1s, 2s, 4s). If all retries fail, a user-safe error message is returned without leaking API keys or error traces.

---

## 4. Known Architectural Limitations & Trade-Offs

1. **Process-Local Rate Limiting:** The in-memory sliding-window rate limiter stores state in process memory. In a multi-container horizontal cluster, rate limits apply per container instance unless backed by a distributed store (e.g., Redis).
2. **Provider-Controlled Quotas:** Google Gemini free-tier quotas are subject to change based on Google Cloud policies. Production administrators must monitor quota utilization in the Google AI Studio console alongside DocuMind's `/admin/usage` telemetry.
3. **Local Storage Ephemerality:** Because DocuMind uses local filesystem storage for document binaries, containerized deployments must mount a persistent host volume (`-v /var/data/documind/storage:/app/storage`). Deploying to serverless hosts with ephemeral filesystems (e.g. Vercel) will cause uploaded files to be lost between cold starts.
