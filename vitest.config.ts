import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // e2e/ holds @playwright/test specs (run via `npm run test:e2e`), a
  // separate test runner — exclude them from vitest's own default glob,
  // which would otherwise also match *.spec.ts there and fail to load
  // them (@playwright/test isn't meant to run under vitest).
  test: {
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
    }),
  ],
})
