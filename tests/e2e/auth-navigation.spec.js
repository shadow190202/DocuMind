import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../../scripts/tests/utils/auth-helper.js";

test.describe("E2E: Authentication & Navigation Gates", () => {
  test.beforeEach(async ({ context }) => {
    await logout(context);
  });

  test("1. Landing page renders branding and call-to-action buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/DocuMind/i);
    const getStartedOrSignIn = page.getByRole("link", { name: /(sign in|get started|dashboard)/i });
    await expect(getStartedOrSignIn.first()).toBeVisible();
  });

  test("2. Unauthenticated access to protected /dashboard redirects away", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/(sign-in|login)/i, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(sign-in|login)/i);
  });

  test("3. Unauthenticated access to /admin/dashboard redirects to sign-in", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/(sign-in|login)/i, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(sign-in|login)/i);
  });

  test("4. Standard user with synthetic auth accesses /dashboard successfully", async ({ page, context }) => {
    await loginAs(context, {
      userId: "dmtest_nav_std_user",
      email: "std@documind.test",
      role: "user",
    });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Dashboard|Documents|Overview/i).first()).toBeVisible();
  });

  test("5. Standard user attempting /admin/dashboard is gated back to /dashboard", async ({ page, context }) => {
    await loginAs(context, {
      userId: "dmtest_nav_std_user2",
      email: "std2@documind.test",
      role: "user",
    });

    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/dashboard$/);
  });

  test("6. Administrator user accesses /admin/dashboard successfully", async ({ page, context }) => {
    await loginAs(context, {
      userId: "dmtest_nav_admin_user",
      email: "admin@documind.test",
      role: "admin",
    });

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText(/Admin|System|Overview|Telemetry/i).first()).toBeVisible();
  });
});
