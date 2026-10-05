import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["**/consultant-copiloto-multicurrency-live.spec.ts", "**/consultant-copiloto-v4-multicurrency-live.spec.ts", "**/consultant-copiloto-fifty-live.spec.ts"],
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL: process.env.E2E_BASE_URL || "http://localhost:3001", ...devices["Desktop Chrome"] },
});
