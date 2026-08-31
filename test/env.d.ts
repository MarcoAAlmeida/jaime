import type { D1Migration } from '@cloudflare/vitest-pool-workers'

// Extra bindings injected only for tests (see vitest.config.ts).
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    PATTERNS_MIGRATIONS: D1Migration[]
    /** Reconcile SQL for the curated catalog (content/patterns/*.md). */
    PATTERNS_SEED_SQL: string
  }
}
