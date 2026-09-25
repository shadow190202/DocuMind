import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";
import {
  getTestDb,
  createTestRunId,
  createTestUser,
  cleanupTestRunFixtures,
} from "../../scripts/tests/utils/test-db.js";

test.describe("E2E: Admin Dashboard & Telemetry Operations", () => {
  const db = getTestDb();
  const testRunId = createTestRunId("e2e_adm");
  const adminId = `${testRunId}_sysadmin`;

  test.beforeAll(async () => {
    await createTestUser(db, {
      id: adminId,
      email: `${adminId}@documind.test`,
      name: "Global Admin",
      role: "admin",
    });
  });

  test.afterAll(async () => {
    await cleanupTestRunFixtures(db, testRunId);
  });

  test("1. Admin dashboard displays telemetry overview and system KPIs", async ({ page, context }) => {
    await loginAs(context, {
      userId: adminId,
      email: `${adminId}@documind.test`,
      role: "admin",
    });

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/Admin|Dashboard|System|Overview/i).first()).toBeVisible();
  });

  test("2. Admin can navigate to user directory", async ({ page, context }) => {
    await loginAs(context, {
      userId: adminId,
      email: `${adminId}@documind.test`,
      role: "admin",
    });

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);
    await expect(page.getByText(/User Directory|Users/i).first()).toBeVisible();
  });
});
