import { applyD1Migrations, env } from 'cloudflare:test'

// Runs once before the suite: brings the freshly-provisioned local
// PATTERNS_DB up to the current schema + seed data. PATTERNS_MIGRATIONS
// is injected by vitest.config.ts via readD1Migrations('migrations/patterns').
await applyD1Migrations(env.PATTERNS_DB, env.PATTERNS_MIGRATIONS)
