import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    {
      name: "smoke",
      testMatch: "**/smoke.spec.ts",
    },
    {
      name: "recurring-series",
      testMatch: "**/recurring-series.spec.ts",
      dependencies: ["smoke"],
    },
    {
      name: "dashboard-recurring-period",
      testMatch: ["**/dashboard-recurring-period.spec.ts", "**/dashboard-period-custom.spec.ts"],
      dependencies: ["smoke"],
    },
    {
      name: "subscription",
      testMatch: ["**/subscription.spec.ts", "**/feature-gating.spec.ts"],
      dependencies: ["smoke"],
    },
    {
      name: "refund",
      testMatch: "**/refund.spec.ts",
    },
    {
      name: "refund-ui",
      testMatch: "**/refund-ui.spec.ts",
      dependencies: ["smoke"],
    },
    {
      name: "settings-categories-tags",
      testMatch: "**/settings-categories-tags.spec.ts",
    },
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        // Em ambientes com CI=1 mas dev já em :3000 (ex.: Cursor), reutiliza o Vite.
        reuseExistingServer: true,
        timeout: 120_000,
        env: { ...process.env },
      },
});
