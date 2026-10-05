import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/consultant-copiloto-live.spec.ts", "**/consultant-copiloto-v4-live.spec.ts"],
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3000", trace: "on-first-retry", ...devices["Desktop Chrome"] },
});
