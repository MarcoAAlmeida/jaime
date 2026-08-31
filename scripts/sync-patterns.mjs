#!/usr/bin/env node
// Reconcile the curated pattern catalog in PATTERNS_DB to the manifest
// under content/patterns/. Run automatically by `npm run deploy`
// (--remote) and `npm run db:migrate:local` (--local); re-run by hand
// with `npm run patterns:sync [-- --remote]`.
//
// See openspec/changes/add-content-authoring/design.md (decisions 3–4).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildReconcileSql, ManifestError } from './lib/patterns-manifest.mjs'

const remote = process.argv.includes('--remote')
const target = remote ? '--remote' : '--local'

let sql
try {
  sql = buildReconcileSql()
}
catch (err) {
  if (err instanceof ManifestError) {
    console.error(`\n✖ ${err.message}\n`)
    process.exit(1)
  }
  throw err
}

console.log(`\n▶ reconciling curated patterns → PATTERNS_DB (${target})\n`)
console.log(sql)

const file = join(mkdtempSync(join(tmpdir(), 'jaime-patterns-')), 'reconcile.sql')
writeFileSync(file, sql)

const args = ['wrangler', 'd1', 'execute', 'PATTERNS_DB', target, '--file', file]
if (remote) args.push('--yes')

const res = spawnSync('npx', args, {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: process.platform === 'win32',
  env: { ...process.env, CI: '1' },
})

if (res.status !== 0) {
  console.error(`\n✖ pattern sync failed (exit ${res.status ?? 'signal'})`)
  process.exit(res.status ?? 1)
}

console.log('\n✔ curated patterns reconciled')
