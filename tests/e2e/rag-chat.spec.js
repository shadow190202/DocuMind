import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../../scripts/tests/utils/test-db.js";
import { documents, documentChunks, conversations, messages } from "../../src/db/schema.js";

test.describe("E2E: RAG Chat & Conversational Assistant", () => {
  const db = getTestDb();
  const testRunId = createTestRunId("e2e_chat");
  const testUserId = `${testRunId}_chatter`;
  const docId = crypto.randomUUID();
  const convId = crypto.randomUUID();

  test.beforeAll(async () => {
    // Seed user, document, chunk, conversation, and message
    await createTestUser(db, {
      id: testUserId,
      email: `${testUserId}@documind.test`,
      name: "RAG User",
      role: "user",
    });

    await db.insert(documents).values({
      id: docId,
      userId: testUserId,
      filename: "product-handbook.pdf",
      fileType: "pdf",
      fileSize: 500000,
      storageUrl: "local://documents/test/product-handbook.pdf",
      processingStatus: "completed",
    });

    await db.insert(documentChunks).values({
      documentId: docId,
      chunkIndex: 0,
      content: "DocuMind provides AI-powered document intelligence.",
      characterCount: 50,
      estimatedTokenCount: 12,
      pageNumber: 1,
    });

    await db.insert(conversations).values({
      id: convId,
      userId: testUserId,
      documentId: docId,
      title: "Handbook Questions",
    });

    await db.insert(messages).values([
      {
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "user",
        content: "What is DocuMind?",
      },
      {
        id: crypto.randomUUID(),
        conversationId: convId,
        role: "assistant",
        content: "DocuMind provides AI-powered document intelligence and semantic search.",
      },
    ]);
  });

  test.afterAll(async () => {
    await cleanupTestRunFixtures(db, testRunId);
  });

  test("1. Chat route loads conversational interface with controls", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto("/chat");
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByPlaceholder(/Ask.*question/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Ask AI|Send/i })).toBeVisible();
  });

  test("2. Navigating to existing conversation renders prior chat history", async ({ page, context }) => {
    await loginAs(context, {
      userId: testUserId,
      email: `${testUserId}@documind.test`,
      role: "user",
    });

    await page.goto(`/chat?id=${convId}`);
    await expect(page.getByText("What is DocuMind?")).toBeVisible();
    await expect(page.getByText(/DocuMind provides AI-powered document intelligence/i)).toBeVisible();
  });
});
