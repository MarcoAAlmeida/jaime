import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  // The pool provisions empty local D1 databases per test run; hand the
  // PATTERNS_DB migrations (schema + seed) to a setup file that applies
  // them before any test. See openspec/changes/add-pattern-library.
  const patternsMigrations = await readD1Migrations('migrations/patterns')

  return {
    // e2e/ holds @playwright/test specs (run via `npm run test:e2e`), a
    // separate test runner — exclude them from vitest's own default glob,
    // which would otherwise also match *.spec.ts there and fail to load
    // them (@playwright/test isn't meant to run under vitest).
    test: {
      exclude: ['**/node_modules/**', 'e2e/**'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            PATTERNS_MIGRATIONS: patternsMigrations,
            // Tests drive auth via minted tokens, not the emailed link —
            // keep the dev "link in the response" behaviour off here even
            // though .dev.vars sets it for `wrangler dev` / `nuxt dev`.
            AUTH_E2E: '',
          },
        },
      }),
    ],
  }
})
