import { db, getDb } from "../../db/index.js";
import { documents, documentPermissions, users } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";

/**
 * Strips server-only fields (such as storageUrl, internal filesystem paths)
 * before sending document metadata to clients.
 *
 * @param {Object} doc - Internal database document row
 * @param {Object} [roleInfo={}] - Authorization metadata
 * @returns {Object|null} Client-safe document representation
 */
export function toClientSafeDocument(doc, roleInfo = {}) {
  if (!doc) return null;
  return {
    id: doc.id,
    filename: doc.filename,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    processingStatus: doc.processingStatus,
    errorMessage: doc.errorMessage || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    role: roleInfo.role || (doc.userId === roleInfo.userId ? "owner" : doc.sharedPermission || "read"),
    isOwner: roleInfo.isOwner !== undefined ? roleInfo.isOwner : (doc.userId === roleInfo.userId),
    owner: {
      id: doc.userId,
      name: doc.ownerName || null,
      email: doc.ownerEmail || null,
    },
  };
}

/**
 * Authoritatively verifies if an authenticated user has the required permission
 * on a specific document.
 *
 * Required semantics:
 * - owner satisfies owner/write/read
 * - editor satisfies write/read
 * - viewer satisfies read
 * - unauthorized access -> uniform 404
 * - insufficient permission for an otherwise authorized collaborator -> 403
 *
 * Server-only data safety:
 * The returned 'document' object contains server fields (e.g. storageUrl, owner's userId)
 * required for internal processing. Route handlers MUST NOT serialize this object directly.
 *
 * @param {Object} params
 * @param {string} params.documentId - Document UUID
 * @param {string} params.userId - Clerk user ID of requesting caller
 * @param {'read' | 'write' | 'owner'} [params.requiredPermission='read']
 * @returns {Promise<{
 *   authorized: boolean,
 *   role: 'owner' | 'write' | 'read' | null,
 *   isOwner: boolean,
 *   document: Object | null,
 *   errorResponse: NextResponse | null
 * }>}
 */
export async function verifyDocumentAccess({
  documentId,
  userId,
  requiredPermission = "read",
}) {
  if (!userId) {
    return {
      authorized: false,
      role: null,
      isOwner: false,
      document: null,
      errorResponse: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!documentId) {
    return {
      authorized: false,
      role: null,
      isOwner: false,
      document: null,
      errorResponse: Response.json(
        { error: "Document ID required." },
        { status: 400 }
      ),
    };
  }

  const activeDb = db || getDb();
  if (!activeDb) {
    return {
      authorized: false,
      role: null,
      isOwner: false,
      document: null,
      errorResponse: Response.json(
        { error: "Database not configured." },
        { status: 503 }
      ),
    };
  }

  const [row] = await activeDb
    .select({
      id: documents.id,
      userId: documents.userId,
      filename: documents.filename,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      storageUrl: documents.storageUrl,
      processingStatus: documents.processingStatus,
      errorMessage: documents.errorMessage,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      sharedPermission: documentPermissions.permission,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.userId))
    .leftJoin(
      documentPermissions,
      and(
        eq(documentPermissions.documentId, documents.id),
        eq(documentPermissions.userId, userId)
      )
    )
    .where(eq(documents.id, documentId));

  // Anti-probing: uniform 404 for non-existent document
  if (!row) {
    return {
      authorized: false,
      role: null,
      isOwner: false,
      document: null,
      errorResponse: Response.json(
        { error: "Document not found or access denied." },
        { status: 404 }
      ),
    };
  }

  // Derive role authoritatively
  let role = null;
  let isOwner = false;

  if (row.userId === userId) {
    role = "owner";
    isOwner = true;
  } else if (row.sharedPermission === "write") {
    role = "write";
  } else if (row.sharedPermission === "read") {
    role = "read";
  }

  // Evaluate permission hierarchy
  let authorized = false;
  if (role === "owner") {
    authorized = true;
  } else if (role === "write" && (requiredPermission === "write" || requiredPermission === "read")) {
    authorized = true;
  } else if (role === "read" && requiredPermission === "read") {
    authorized = true;
  }

  if (!authorized) {
    // If user has zero access to document, return 404 to prevent IDOR existence probing
    if (!role) {
      return {
        authorized: false,
        role: null,
        isOwner: false,
        document: null,
        errorResponse: Response.json(
          { error: "Document not found or access denied." },
          { status: 404 }
        ),
      };
    }

    // Collaborator exists but has insufficient role for the requested operation
    return {
      authorized: false,
      role,
      isOwner,
      document: row,
      errorResponse: Response.json(
        { error: `Insufficient permissions. Requires '${requiredPermission}' access.` },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    role,
    isOwner,
    document: row,
    errorResponse: null,
  };
}

/**
 * Authoritatively verifies access to two documents simultaneously (for comparisons).
 * Uniform 404 if either document is inaccessible or missing.
 *
 * @param {Object} params
 * @param {string} params.sourceDocumentId - Source Document UUID
 * @param {string} params.targetDocumentId - Target Document UUID
 * @param {string} params.userId - Clerk user ID
 * @param {'read' | 'write' | 'owner'} [params.requiredPermission='read']
 * @returns {Promise<{
 *   authorized: boolean,
 *   source: Object,
 *   target: Object,
 *   errorResponse: NextResponse | null
 * }>}
 */
export async function verifyDualDocumentAccess({
  sourceDocumentId,
  targetDocumentId,
  userId,
  requiredPermission = "read",
}) {
  const [sourceCheck, targetCheck] = await Promise.all([
    verifyDocumentAccess({
      documentId: sourceDocumentId,
      userId,
      requiredPermission,
    }),
    verifyDocumentAccess({
      documentId: targetDocumentId,
      userId,
      requiredPermission,
    }),
  ]);

  if (!sourceCheck.authorized || !targetCheck.authorized) {
    return {
      authorized: false,
      source: sourceCheck,
      target: targetCheck,
      errorResponse: Response.json(
        { error: "One or both documents not found or access denied." },
        { status: 404 }
      ),
    };
  }

  return {
    authorized: true,
    source: sourceCheck,
    target: targetCheck,
    errorResponse: null,
  };
}
