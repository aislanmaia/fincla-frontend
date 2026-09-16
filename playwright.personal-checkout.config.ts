import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'personal-checkout.spec.ts', workers: 1,
  use: { baseURL: 'http://localhost:3118' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: { command: 'npm run dev -- --port 3118', url: 'http://localhost:3118', reuseExistingServer: false },
});
