import type { H3Event } from 'h3'
import { isMigrated } from '../catalog/patterns'

// The Catalog D1 binding. Present on the h3 event context in every
// environment: `plugin.dev.mjs` sets `context.cloudflare` in dev, and
// the cloudflare-durable preset spreads `_platform.cloudflare` onto the
// context in production and under vitest-pool-workers.
export function usePatternsDb(event: H3Event): D1Database {
  const db = (event.context.cloudflare as { env?: Env } | undefined)?.env?.PATTERNS_DB
  if (!db) {
    throw createError({
      statusCode: 500,
      statusMessage: 'PATTERNS_DB binding is not available',
    })
  }
  return db
}

/** Throws a clean 503 when the Catalog schema hasn't been migrated. */
export async function assertPatternsMigrated(db: D1Database): Promise<void> {
  if (!(await isMigrated(db))) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Pattern catalog database has not been migrated',
    })
  }
}
