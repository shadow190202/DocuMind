import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../../scripts/tests/utils/test-db.js";
import { documents, documentPermissions } from "../../src/db/schema.js";

test.describe("E2E: Document Sharing & Permissions UI", () => {
  const db = getTestDb();
  const testRunId = createTestRunId("e2e_perm");
  const ownerId = `${testRunId}_owner`;
  const collabId = `${testRunId}_collab`;
  const docId = crypto.randomUUID();

  test.beforeAll(async () => {
    // Seed owner, collaborator, document, and shared permission
    await createTestUser(db, {
      id: ownerId,
      email: `${ownerId}@documind.test`,
      name: "Sharing Owner",
      role: "user",
    });

    await createTestUser(db, {
      id: collabId,
      email: `${collabId}@documind.test`,
      name: "Invited Collab",
      role: "user",
    });

    await db.insert(documents).values({
      id: docId,
      userId: ownerId,
      filename: "project-spec.pdf",
      fileType: "pdf",
      fileSize: 100000,
      storageUrl: "local://documents/test/project-spec.pdf",
      processingStatus: "completed",
    });

    await db.insert(documentPermissions).values({
      documentId: docId,
      userId: collabId,
      permission: "read",
    });
  });

  test.afterAll(async () => {
    await cleanupTestRunFixtures(db, testRunId);
  });

  test("1. Owner sees their owned document with owner status", async ({ page, context }) => {
    await loginAs(context, {
      userId: ownerId,
      email: `${ownerId}@documind.test`,
      role: "user",
    });

    await page.goto("/documents");
    await expect(page.getByText("project-spec.pdf")).toBeVisible();
    await expect(page.getByText(/Owner/i).first()).toBeVisible();
  });

  test("2. Collaborator sees document shared with them", async ({ page, context }) => {
    await loginAs(context, {
      userId: collabId,
      email: `${collabId}@documind.test`,
      role: "user",
    });

    await page.goto("/documents");
    await expect(page.getByText("project-spec.pdf")).toBeVisible();
    await expect(page.getByText(/Shared with me|Viewer|Read/i).first()).toBeVisible();
  });
});
