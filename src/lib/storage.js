import fs from "fs";
import path from "path";
import crypto from "crypto";

// Root storage directory outside public web root for security
const STORAGE_ROOT = path.resolve(process.cwd(), "storage", "documents");

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
 * Saves a file buffer securely to the user's isolated storage directory.
 * @param {Buffer} buffer - File buffer
 * @param {string} originalFilename - Original uploaded filename
 * @param {string} userId - Authenticated user ID (Clerk ID)
 * @returns {Promise<{ storageUrl: string, fileId: string, filePath: string }>}
 */
export async function saveFile(buffer, originalFilename, userId) {
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const userDir = path.join(STORAGE_ROOT, sanitizedUserId);
  ensureDirectory(userDir);

  const fileId = crypto.randomUUID();
  const ext = path.extname(originalFilename).toLowerCase();
  const baseName = path
    .basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  const uniqueFileName = `${fileId}-${baseName}${ext}`;
  const filePath = path.join(userDir, uniqueFileName);

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
  if (!storageUrl.startsWith("local://documents/")) {
    throw new Error("Invalid storage URL protocol.");
  }

  const relativePath = storageUrl.replace("local://documents/", "");
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

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
  if (!storageUrl || !storageUrl.startsWith("local://documents/")) {
    return false;
  }

  try {
    const relativePath = storageUrl.replace("local://documents/", "");
    const absolutePath = path.join(STORAGE_ROOT, relativePath);

    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
      return true;
    }
  } catch (error) {
    console.error("Failed to delete file from storage:", error);
  }

  return false;
}
