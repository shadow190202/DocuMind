import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.js",
  globalTeardown: "./tests/e2e/global-teardown.js",
  fullyParallel: false,
  workers: 1, // Strictly single worker per execution plan
  retries: 0,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx next start -p 3001",
    url: "http://localhost:3001",
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      DOCUMIND_E2E_MODE: "enabled",
      DOCUMIND_MOCK_AI: "true",
      DOCUMIND_E2E_SECRET: "documind_e2e_testing_secret_key_32chars",
      PORT: "3001",
    },
  },
});
