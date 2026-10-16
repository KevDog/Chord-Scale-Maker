import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

/** browser tests against the production static build (run `npm run e2e`, which builds first) */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: !!process.env.CI, // a retry that passes still fails CI
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // the axe scans (e2e/a11y/*.a11y.ts) are their own project, kept out of `npm run e2e`: `npm run a11y` runs them
  projects: [
    { name: 'chromium', testMatch: '**/*.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } } },
    { name: 'a11y', testMatch: '**/*.a11y.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } } },
  ],
  // nuxt preview runs the built server (prerendered pages + /api/contact), which takes its port from PORT;
  // the contact form validates without sending email (NUXT_CONTACT_DRY_RUN)
  webServer: { command: 'npx nuxt preview', env: { PORT: String(PORT), NUXT_CONTACT_DRY_RUN: 'true' }, port: PORT, reuseExistingServer: !process.env.CI },
})
