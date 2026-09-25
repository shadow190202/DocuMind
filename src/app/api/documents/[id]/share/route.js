/**
 * POST /api/documents/:id/share
 *
 * Direct compatibility alias for POST /api/documents/:id/permissions
 * as specified in PROJECT_SPEC.txt Section 12.
 * Delegates directly to the canonical permissions route handler to eliminate code duplication.
 */
export { POST } from "../permissions/route";
