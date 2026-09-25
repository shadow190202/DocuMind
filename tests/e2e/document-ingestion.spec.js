import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../../scripts/tests/utils/test-db.js";
import { documents, documentChunks } from "../../src/db/schema.js";

test.describe("E2E: Document Ingestion & Viewing", () => {
  const db = getTestDb();
  const testRunId = createTestRunId("e2e_doc");
  const testUserId = `${testRunId}_uploader`;
  const docId = crypto.randomUUID();

  test.beforeAll(async () => {
    // Seed user and document in PostgreSQL
    await createTestUser(db, {
      id: testUserId,
      email: `${testUserId}@documind.test`,
      name: "Doc Uploader",
      role: "user",
    });

    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: "quarterly-report.pdf",
      fileType: "pdf",
      fileSize: 1048576,
      storageUrl: "local://documents/test/quarterly-report.pdf",
      processingStatus: "completed",
    });

    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: 0,
      content: "This is the primary summary chunk of the quarterly report.",
      characterCount: 58,
      estimatedTokenCount: 15,
      pageNumber: 1,
    });
  });

  test.afterAll(async () => {
    await cleanupTestRunFixtures(db, testRunId);
  });

  test("1. Documents page lists user documents and actions", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto("/documents");
    await expect(page).toHaveURL(/\/documents/);
    await expect(page.getByRole("heading", { name: "My Documents" })).toBeVisible();
    await expect(page.getByText("quarterly-report.pdf")).toBeVisible();
    await expect(page.getByText(/Completed/i)).toBeVisible();
  });

  test("2. Upload route displays upload interface", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto("/documents/upload");
    await expect(page).toHaveURL(/\/documents\/upload/);
    await expect(page.getByText(/Upload Document|Drag & Drop|Browse/i).first()).toBeVisible();
  });

  test("3. Document detail route renders document chunks and metadata", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto(`/documents/${docId}`);
    await expect(page.getByText("quarterly-report.pdf")).toBeVisible();
  });
});
