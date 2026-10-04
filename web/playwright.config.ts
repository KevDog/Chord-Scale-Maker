import { defineConfig, devices } from '@playwright/test'

const PORT = 4174

/** browser tests against the production static build (run `npm run e2e`, which builds first) */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } } }],
  // nuxt preview serves a static build with `serve`, which takes its port from PORT (not --port)
  webServer: { command: 'npx nuxt preview', env: { PORT: String(PORT) }, port: PORT, reuseExistingServer: !process.env.CI },
})
