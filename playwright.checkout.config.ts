import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['checkout-offer.spec.ts', 'personal-checkout.spec.ts', 'consultant-checkout.spec.ts', 'consultant-capacity.spec.ts', 'checkout-recovery.spec.ts'],
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://localhost:3101' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 3101', url: 'http://localhost:3101', reuseExistingServer: false },
    { command: 'npm --prefix ../site run dev -- --port 3102', url: 'http://localhost:3102', reuseExistingServer: false },
  ],
});
