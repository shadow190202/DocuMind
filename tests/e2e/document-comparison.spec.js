import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../../scripts/tests/utils/test-db.js";
import { documents, documentComparisons } from "../../src/db/schema.js";

test.describe("E2E: Document Comparison UI", () => {
  const db = getTestDb();
  const testRunId = createTestRunId("e2e_comp");
  const testUserId = `${testRunId}_evaluator`;
  const docAId = crypto.randomUUID();
  const docBId = crypto.randomUUID();

  test.beforeAll(async () => {
    await createTestUser(db, {
      id: testUserId,
      email: `${testUserId}@documind.test`,
      name: "Comp Evaluator",
      role: "user",
    });

    await db.insert(documents).values([
      {
        id: docAId,
        userId: testUserId,
        filename: "version-1.0.pdf",
        fileType: "pdf",
        fileSize: 50000,
        storageUrl: "local://documents/test/v1.pdf",
        processingStatus: "completed",
      },
      {
        id: docBId,
        userId: testUserId,
        filename: "version-2.0.pdf",
        fileType: "pdf",
        fileSize: 55000,
        storageUrl: "local://documents/test/v2.pdf",
        processingStatus: "completed",
      },
    ]);

    await db.insert(documentComparisons).values({
      userId: testUserId,
      sourceDocumentId: docAId,
      targetDocumentId: docBId,
      content: "Both documents describe baseline procedures.",
      structuredData: {
        sharedThemes: ["Procedures"],
        differences: ["Version increments"],
      },
      model: "gemini-3.8-flash",
    });
  });

  test.afterAll(async () => {
    await cleanupTestRunFixtures(db, testRunId);
  });

  test("1. Compare page renders header and selection interface", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto("/compare");
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByText("Document Comparison").first()).toBeVisible();
    await expect(page.getByText(/Select|Choose|Compare/i).first()).toBeVisible();
  });

  test("2. Compare view opens native regeneration dialog in Top Layer and closes via Cancel", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto(`/compare?sourceId=${docAId}&targetId=${docBId}`);
    await expect(page).toHaveURL(/\/compare/);

    // Locate and click the Regenerate button
    const regenerateBtn = page.getByRole("button", { name: "Regenerate" }).first();
    await expect(regenerateBtn).toBeVisible();
    await regenerateBtn.click();

    // Assert native <dialog> is in Top Layer
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: /Regenerate document comparison/i })).toBeVisible();

    // Click Cancel to trigger native .close()
    await dialog.getByRole("button", { name: /Cancel/i }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });
});
