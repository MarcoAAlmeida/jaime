import type { D1Migration } from '@cloudflare/vitest-pool-workers'

// Extra bindings injected only for tests (see vitest.config.ts). They are
// added to the global `Cloudflare.Env` — the type `env` from
// `cloudflare:test` / `cloudflare:workers` has — and this file is only in
// the tests' typecheck (tsconfig.tests.json), never the Worker's.
declare global {
  namespace Cloudflare {
    interface Env {
      PATTERNS_MIGRATIONS: D1Migration[]
      /** Reconcile SQL for the curated catalog (content/patterns/*.md). */
      PATTERNS_SEED_SQL: string
    }
  }
}
