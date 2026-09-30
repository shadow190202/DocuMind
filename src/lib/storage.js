import fs from "fs";
import path from "path";
import crypto from "crypto";
import { put, get, del } from "@vercel/blob";

// Root storage directories outside public web root for security
export const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "documents");
export const EXTRACTED_ROOT = path.resolve(process.cwd(), "storage", "extracted");

/**
 * Determines current storage provider: 'vercel-blob' | 'local'
 * @returns {'vercel-blob' | 'local'}
 */
export function getStorageProvider() {
  const configured = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (configured === "vercel-blob") return "vercel-blob";
  if (configured === "local") return "local";
  // If BLOB_READ_WRITE_TOKEN is configured and not explicitly local, use vercel-blob
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return "local";
}

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
      const canonicalRoot = fs.existsSync(normalizedRoot)
        ? fs.realpathSync(normalizedRoot)
        : normalizedRoot;
      if (!realPath.toLowerCase().startsWith(canonicalRoot.toLowerCase() + path.sep)) {
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
 * Saves a file buffer securely to the user's isolated storage directory or Vercel Blob.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} userId - Authenticated user ID (Clerk ID)
 * @returns {Promise<{ storageUrl: string, fileId: string, filePath: string }>}
 */
export async function saveFile(buffer, originalFilename, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileId = crypto.randomUUID();
  const ext = path.extname(originalFilename).toLowerCase();
  const baseName = path
    .basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  const uniqueFileName = `${fileId}-${baseName}${ext}`;

  if (getStorageProvider() === "vercel-blob") {
    const blobPath = `documents/${sanitizedUserId}/${uniqueFileName}`;
    const blob = await put(blobPath, buffer, {
      access: "private",
      addRandomSuffix: false,
    });

    return {
      storageUrl: blob.url,
      fileId,
      filePath: blob.url,
    };
  }

  const userDir = safeResolvePath(STORAGE_ROOT, sanitizedUserId);
  ensureDirectory(userDir);

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
 * Reads a stored file buffer given its storageUrl (local:// or Vercel Blob URL).
 * @param {string} storageUrl 
 * @returns {Promise<Buffer>}
 */
export async function getFile(storageUrl) {
  if (!storageUrl || typeof storageUrl !== "string") {
    throw new Error("Invalid storage URL.");
  }

  if (storageUrl.startsWith("local://documents/")) {
    const rawRelativePath = storageUrl.replace("local://documents/", "");
    const absolutePath = safeResolvePath(STORAGE_ROOT, rawRelativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error("File not found in storage.");
    }

    return fs.promises.readFile(absolutePath);
  }

  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    const headers = {};
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
    }

    const response = await fetch(storageUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("File not found in storage.");
      }
      throw new Error(`Failed to fetch blob: (${response.status}) ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw new Error("Invalid storage URL protocol.");
}

/**
 * Deletes a file from storage given its storageUrl.
 * @param {string} storageUrl 
 * @returns {Promise<boolean>}
 */
export async function deleteFile(storageUrl) {
  if (!storageUrl || typeof storageUrl !== "string") {
    return false;
  }

  if (storageUrl.startsWith("local://documents/")) {
    try {
      const rawRelativePath = storageUrl.replace("local://documents/", "");
      const absolutePath = safeResolvePath(STORAGE_ROOT, rawRelativePath);

      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
        return true;
      }
    } catch (error) {
      console.error("Failed to delete file from local storage:", error.message);
    }
    return false;
  }

  if (storageUrl.startsWith("http://") || storageUrl.startsWith("https://")) {
    try {
      await del(storageUrl);
      return true;
    } catch (error) {
      console.error("Failed to delete file from blob storage:", error.message);
    }
    return false;
  }

  return false;
}

/**
 * Saves extracted document text and metadata.
 * @param {Object} data - Extracted data object
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<string>} - Absolute path or URL to stored JSON
 */
export async function saveExtractedData(data, documentId, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const jsonContent = JSON.stringify(data, null, 2);

  if (getStorageProvider() === "vercel-blob") {
    const blobPath = `extracted/${sanitizedUserId}/${sanitizedDocId}.json`;
    const blob = await put(blobPath, jsonContent, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return blob.url;
  }

  const userDir = safeResolvePath(EXTRACTED_ROOT, sanitizedUserId);
  ensureDirectory(userDir);

  const filePath = safeResolvePath(userDir, `${sanitizedDocId}.json`);
  await fs.promises.writeFile(filePath, jsonContent, "utf8");
  return filePath;
}

/**
 * Retrieves extracted document data for a document.
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<Object|null>} - Parsed extracted data or null
 */
export async function getExtractedData(documentId, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Check local filesystem first
  try {
    const filePath = safeResolvePath(EXTRACTED_ROOT, `${sanitizedUserId}/${sanitizedDocId}.json`);
    if (fs.existsSync(filePath)) {
      const raw = await fs.promises.readFile(filePath, "utf8");
      return JSON.parse(raw);
    }
  } catch {
    // Continue to blob if local path resolution fails or file does not exist
  }

  // Check Vercel Blob if configured
  if (getStorageProvider() === "vercel-blob" || process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blobPath = `extracted/${sanitizedUserId}/${sanitizedDocId}.json`;
      const result = await get(blobPath, { access: "private", useCache: false });
      if (result) {
        const stream = result.stream || result.body;
        if (stream) {
          const text = await new Response(stream).text();
          return JSON.parse(text);
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Deletes extracted document data for a document.
 * @param {string} documentId - Document UUID
 * @param {string} userId - Clerk user ID
 * @returns {Promise<boolean>}
 */
export async function deleteExtractedData(documentId, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sanitizedDocId = documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  let deleted = false;

  try {
    const filePath = safeResolvePath(EXTRACTED_ROOT, `${sanitizedUserId}/${sanitizedDocId}.json`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      deleted = true;
    }
  } catch (error) {
    console.error("Failed to delete extracted data from local storage:", error.message);
  }

  if (getStorageProvider() === "vercel-blob" || process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blobPath = `extracted/${sanitizedUserId}/${sanitizedDocId}.json`;
      await del(blobPath);
      deleted = true;
    } catch (error) {
      // Ignored if not found in blob
    }
  }

  return deleted;
}
