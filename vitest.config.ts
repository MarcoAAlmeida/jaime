import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'
import { buildReconcileSql } from './scripts/lib/patterns-manifest.mjs'

export default defineConfig(async () => {
  // The pool provisions empty local D1 databases per test run; hand the
  // PATTERNS_DB migrations (schema) to a setup file that applies them
  // before any test. See openspec/changes/add-pattern-library.
  const patternsMigrations = await readD1Migrations('migrations/patterns')
  // The curated catalog lives in content/patterns/*.md, not a migration —
  // reconcile the test DB to it the same way `npm run deploy` does.
  const patternsSeedSql = buildReconcileSql()

  return {
    // e2e/ holds @playwright/test specs (run via `npm run test:e2e`), a
    // separate test runner — exclude them from vitest's own default glob,
    // which would otherwise also match *.spec.ts there and fail to load
    // them (@playwright/test isn't meant to run under vitest).
    test: {
      // e2e/ is @playwright/test; scripts/ holds `node --test` files that
      // use node: builtins — neither runs under the workers pool.
      // refers_to/ holds vendored git submodules (add-strudel-knowledge-corpus
      // initializes refers_to/strudel for real) — their own test suites are
      // not ours to run; without this, once a submodule is checked out,
      // vitest's default glob silently starts sweeping up and failing on
      // its unrelated tests (found running the real pipeline, 2026-09-22).
      exclude: ['**/node_modules/**', 'e2e/**', 'scripts/**', 'refers_to/**'],
      setupFiles: ['./test/apply-migrations.ts'],
    },
    plugins: [
      cloudflareTest({
        // The `AI` binding is always remote, so by default every run opened
        // a live connection to Cloudflare (slow, needs network + login, can
        // spend money, and left the process hanging at exit). Tests never
        // need a real model — `JAH_E2E` stubs it and test/jah-reply.test.ts
        // passes a fake — so keep everything local.
        remoteBindings: false,
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            PATTERNS_MIGRATIONS: patternsMigrations,
            PATTERNS_SEED_SQL: patternsSeedSql,
            // Tests drive auth via minted tokens, not the emailed link —
            // keep the dev "link in the response" behaviour off here even
            // though .dev.vars sets it for `wrangler dev` / `nuxt dev`.
            AUTH_E2E: '',
            // test/jah-chat.test.ts asserts the JAH_E2E canned reply.
            // Without this, the suite relied on the gitignored
            // .dev.vars — and in CI (no .dev.vars, JAH_ENABLED=1 from
            // wrangler.jsonc) it hit the real Workers AI model.
            JAH_E2E: '1',
            // test/session-verify.test.ts presents this header value;
            // fixed here so the suite never depends on the gitignored
            // .dev.vars (or a real secret).
            GAMES_VERIFY_SECRET: 'test-verify-secret',
          },
        },
      }),
    ],
  }
})
