import assert from "assert";
import fs from "fs";
import path from "path";
import {
  safeResolvePath,
  saveFile,
  getFile,
  deleteFile,
  STORAGE_ROOT,
} from "../../../src/lib/storage.js";

export async function run() {
  console.log("\n--- Unit Tests: Storage Containment & Security ---");
  let passed = 0;

  // 1. Safe relative path resolves strictly within root
  const resolved = safeResolvePath(STORAGE_ROOT, "user1/document.pdf");
  assert(resolved.startsWith(path.resolve(STORAGE_ROOT)));
  assert(resolved.endsWith("document.pdf"));
  console.log("  ✅ Safe relative path resolves strictly within root boundary");
  passed++;

  // 2. Directory traversal attempts are caught and blocked
  const traversalVectors = [
    "../secret.txt",
    "../../etc/passwd",
    "..\\..\\windows\\win.ini",
    "user1/../../system32/cmd.exe",
  ];

  for (const vector of traversalVectors) {
    let blocked = false;
    try {
      safeResolvePath(STORAGE_ROOT, vector);
    } catch (err) {
      blocked = true;
      assert(err.message.includes("Security violation") || err.message.includes("path traversal"));
    }
    assert.strictEqual(blocked, true, `Traversal vector '${vector}' should have been blocked`);
  }
  console.log("  ✅ Directory traversal attempts (POSIX and Windows) are strictly blocked");
  passed++;

  // 3. Encoded traversal vectors (%2e%2e)
  const encodedVectors = [
    "%2e%2e%2fsecret.txt",
    "user1/%2e%2e/%2e%2e/etc/passwd",
  ];
  for (const vector of encodedVectors) {
    let blocked = false;
    try {
      safeResolvePath(STORAGE_ROOT, vector);
    } catch (err) {
      blocked = true;
    }
    assert.strictEqual(blocked, true, `Encoded traversal vector '${vector}' should have been blocked`);
  }
  console.log("  ✅ Percent-encoded traversal vectors are safely decoded and blocked");
  passed++;

  // 4. Null-byte injection defense
  const nullByteVectors = [
    "safe_name.pdf\0.exe",
    "document.pdf%00.bat",
  ];
  for (const vector of nullByteVectors) {
    let blocked = false;
    try {
      safeResolvePath(STORAGE_ROOT, vector);
    } catch (err) {
      blocked = true;
      assert(err.message.includes("null byte"));
    }
    assert.strictEqual(blocked, true, `Null byte vector '${vector}' should have been blocked`);
  }
  console.log("  ✅ Null-byte injection in storage paths is strictly rejected");
  passed++;

  // 5. Save, Read, and Delete File round-trip
  const testUserId = "dmtest_storage_unit_user";
  const testContent = Buffer.from("Unit test storage payload contents", "utf8");
  const saveRes = await saveFile(testContent, "my-unit-report.pdf", testUserId);

  assert(saveRes.storageUrl.startsWith("local://documents/"));
  assert(fs.existsSync(saveRes.filePath));

  const readBack = await getFile(saveRes.storageUrl);
  assert.strictEqual(readBack.toString("utf8"), testContent.toString("utf8"));

  await deleteFile(saveRes.storageUrl);
  assert.strictEqual(fs.existsSync(saveRes.filePath), false);

  // Clean up user dir if empty
  const userDir = path.dirname(saveRes.filePath);
  try {
    fs.rmdirSync(userDir);
  } catch {}

  console.log("  ✅ Save, get, and delete file execute safely within sandbox boundaries");
  passed++;

  return { passed, failed: 0 };
}

if (process.argv[1]?.endsWith("storage.test.mjs")) {
  run().then((r) => {
    console.log(`\nStorage unit tests passed: ${r.passed}`);
    process.exit(0);
  }).catch((err) => {
    console.error("Storage unit tests failed:", err);
    process.exit(1);
  });
}
