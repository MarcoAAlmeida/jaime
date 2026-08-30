import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'npm run build && npx wrangler dev --port 8788',
    url: 'http://127.0.0.1:8788/',
    // Locally, reuse a `wrangler dev` you already have running against a
    // fresh build — spawning the full build+wrangler+workerd chain from
    // inside Playwright's process tree is flaky on Windows. CI always
    // starts its own.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:8788',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
