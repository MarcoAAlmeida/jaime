import { applyD1Migrations, env } from 'cloudflare:test'

// Runs once before the suite: brings the freshly-provisioned local
// PATTERNS_DB up to the current schema, then reconciles the curated
// pattern catalog to content/patterns/*.md — the same SQL `npm run
// deploy` applies. Both values are injected by vitest.config.ts.
// The reconcile SQL is generated one statement per line.
await applyD1Migrations(env.PATTERNS_DB, env.PATTERNS_MIGRATIONS)

for (const line of env.PATTERNS_SEED_SQL.split('\n')) {
  const sql = line.trim().replace(/;$/, '')
  if (sql && !sql.startsWith('--')) await env.PATTERNS_DB.prepare(sql).run()
}
