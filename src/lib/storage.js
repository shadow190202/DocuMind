import fs from "fs";
import path from "path";
import crypto from "crypto";

// Root storage directories outside public web root for security
export const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "documents");
export const EXTRACTED_ROOT = path.resolve(process.cwd(), "storage", "extracted");

/**
 * Ensures the target directory exists.
 * @param {string} dirPath 
 */
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Validates and safely resolves a relative path within an authorized root directory.
 * Protects against directory traversal (../), null-byte injections, and symlink escapes.
 *
 * @param {string} rootDir - Root directory to contain within
 * @param {string} relativePath - Target relative path
 * @returns {string} - Verified absolute path
 * @throws {Error} If path escapes root directory or contains illegal sequences
 */
export function safeResolvePath(rootDir, relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("Invalid storage path.");
  }

  // Reject null-byte injection attempts
  if (relativePath.includes("\0") || relativePath.includes("%00")) {
    throw new Error("Security violation: null byte detected in path.");
  }

  // Safe URL decoding
  let decoded = relativePath;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    throw new Error("Security violation: malformed percent-encoded path.");
  }

  if (decoded.includes("\0")) {
    throw new Error("Security violation: null byte detected in decoded path.");
  }

  const normalizedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(normalizedRoot, decoded);

  // Containment assertion: resolved path MUST be strictly inside normalizedRoot
  if (!resolvedPath.startsWith(normalizedRoot + path.sep)) {
    throw new Error("Security violation: path traversal detected.");
  }

  // Symlink escape defense: if file exists on disk, assert realpath also stays within root
  if (fs.existsSync(resolvedPath)) {
    try {
      const realPath = fs.realpathSync(resolvedPath);
      if (!realPath.startsWith(normalizedRoot + path.sep)) {
        throw new Error("Security violation: symlink escape detected.");
      }
    } catch (symErr) {
      if (symErr.message?.includes("Security violation")) {
        throw symErr;
      }
    }
  }

  return resolvedPath;
}

/**
 * Saves a file buffer securely to the user's isolated storage directory.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} userId - Authenticated user ID (Clerk ID)
 * @returns {Promise<{ storageUrl: string, fileId: string, filePath: string }>}
 */
export async function saveFile(buffer, originalFilename, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const userDir = safeResolvePath(STORAGE_ROOT, sanitizedUserId);
  ensureDirectory(userDir);

  const fileId = crypto.randomUUID();
  const ext = path.extname(originalFilename).toLowerCase();
  const baseName = path
    .basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  const uniqueFileName = `${fileId}-${baseName}${ext}`;
  const filePath = safeResolvePath(userDir, uniqueFileName);

  await fs.promises.writeFile(filePath, buffer);

  // Return relative storage URL representation
  const storageUrl = `local://documents/${sanitizedUserId}/${uniqueFileName}`;

  return {
    storageUrl,
    fileId,
    filePath,
  };
}

/**
 * Reads a stored file buffer given its storageUrl.
 * @param {string} storageUrl 
 * @returns {Promise<Buffer>}
 */
export async function getFile(storageUrl) {
  if (!storageUrl || typeof storageUrl !== "string" || !storageUrl.startsWith("local://documents/")) {
    throw new Error("Invalid storage URL protocol.");
  }

  const rawRelativePath = storageUrl.replace("local://documents/", "");
  const absolutePath = safeResolvePath(STORAGE_ROOT, rawRelativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error("File not found in storage.");
  }

  return fs.promises.readFile(absolutePath);
}

/**
 * Deletes a file from storage given its storageUrl.
 * @param {string} storageUrl 
 * @returns {Promise<boolean>}
 */
export async function deleteFile(storageUrl) {
  if (!storageUrl || typeof storageUrl !== "string" || !storageUrl.startsWith("local://documents/")) {
    return false;
  }

  try {
    const rawRelativePath = storageUrl.replace("local://documents/", "");
    const absolutePath = safeResolvePath(STORAGE_ROOT, rawRelativePath);

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
      return true;
    }
  } catch (error) {
    console.error("Failed to delete file from storage:", error.message);
  }

  return false;
}

/**
 * Saves extracted document text and metadata.
 * @param {Object} data - Extracted data object
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<string>} - Absolute path to stored JSON
 */
export async function saveExtractedData(data, documentId, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const userDir = safeResolvePath(EXTRACTED_ROOT, sanitizedUserId);
  ensureDirectory(userDir);

  const filePath = safeResolvePath(userDir, `${sanitizedDocId}.json`);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return filePath;
}

/**
 * Retrieves extracted document data for a document.
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Object|null>} - Parsed extracted data or null
 */
export async function getExtractedData(documentId, userId) {
  try {
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = safeResolvePath(EXTRACTED_ROOT, `${sanitizedUserId}/${sanitizedDocId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = await fs.promises.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Deletes extracted document data for a document.
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<boolean>}
 */
export async function deleteExtractedData(documentId, userId) {
  try {
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = safeResolvePath(EXTRACTED_ROOT, `${sanitizedUserId}/${sanitizedDocId}.json`);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
  } catch (error) {
    console.error("Failed to delete extracted data from storage:", error.message);
  }
  return false;
}
