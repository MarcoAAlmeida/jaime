#!/usr/bin/env node
// Reconcile the knowledge corpus in PATTERNS_DB to content/knowledge/
// strudel.json. Run automatically by `npm run deploy` (--remote) and
// `npm run db:migrate:local` (--local); re-run by hand with
// `node scripts/sync-knowledge.mjs [--remote]`.
//
// Structurally identical to scripts/sync-patterns.mjs — see
// openspec/changes/add-knowledge-store/design.md — except it does not
// echo the full SQL to the console first: at ~1,400 chunks it would be
// several hundred KB of CI log noise every deploy, unlike the small
// pattern manifest.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildKnowledgeReconcileSql } from './lib/knowledge-store.mjs'

const remote = process.argv.includes('--remote')
const target = remote ? '--remote' : '--local'

const sql = buildKnowledgeReconcileSql()

console.log(`\n▶ reconciling knowledge corpus → PATTERNS_DB (${target})\n`)

const file = join(mkdtempSync(join(tmpdir(), 'jaime-knowledge-')), 'reconcile.sql')
writeFileSync(file, sql)

const args = ['wrangler', 'd1', 'execute', 'PATTERNS_DB', target, '--file', file]
if (remote) args.push('--yes')

const res = spawnSync('npx', args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
  env: { ...process.env, CI: '1' },
})

if (res.status !== 0) {
  console.error(`\n✖ knowledge sync failed (exit ${res.status ?? 'signal'})`)
  process.exit(res.status ?? 1)
}

console.log('\n✔ knowledge corpus reconciled')
