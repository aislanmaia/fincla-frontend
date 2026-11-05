import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/consultant-expense-stream.spec.ts',
  use: { baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3182', ...devices['Desktop Chrome'] },
  timeout: 60_000,
});
