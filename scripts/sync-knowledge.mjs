#!/usr/bin/env node
// Reconcile the knowledge corpus in PATTERNS_DB to content/knowledge/
// strudel.json, then (on --remote only) embed and upsert into the
// Vectorize semantic index (add-knowledge-search). Run automatically by
// `npm run deploy` (--remote) and `npm run db:migrate:local` (--local);
// re-run by hand with `node scripts/sync-knowledge.mjs [--remote]`.
//
// The D1 phase is structurally identical to scripts/sync-patterns.mjs —
// see openspec/changes/add-knowledge-store/design.md — except it does
// not echo the full SQL to the console first: at ~1,400 chunks it would
// be several hundred KB of CI log noise every deploy, unlike the small
// pattern manifest.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { embedAndUpsert, toEmbeddingTrackingSql } from './lib/knowledge-search.mjs'
import { buildKnowledgeReconcileSql, readCorpus } from './lib/knowledge-store.mjs'

const remote = process.argv.includes('--remote')
const target = remote ? '--remote' : '--local'

function runD1(args) {
  const res = spawnSync('npx', ['wrangler', 'd1', 'execute', 'PATTERNS_DB', target, ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1' },
  })
  if (res.status !== 0) {
    console.error(`\n✖ knowledge sync failed (exit ${res.status ?? 'signal'})`)
    process.exit(res.status ?? 1)
  }
}

function runD1File(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'jaime-knowledge-')), 'reconcile.sql')
  writeFileSync(file, sql)
  const args = ['--file', file]
  if (remote) args.push('--yes')
  runD1(args)
}

/** The current tracking-table hashes, read via the same subprocess mechanism every other D1 read/write in this repo uses. */
function readExistingHashes() {
  const args = ['wrangler', 'd1', 'execute', 'PATTERNS_DB', target, '--command',
    'SELECT chunk_id, text_hash FROM knowledge_chunk_embeddings', '--json']
  const output = execFileSync('npx', args, { shell: process.platform === 'win32', env: { ...process.env, CI: '1' } }).toString()
  const [{ results }] = JSON.parse(output)
  return new Map(results.map(r => [r.chunk_id, r.text_hash]))
}

console.log(`\n▶ reconciling knowledge corpus → PATTERNS_DB (${target})\n`)
runD1File(buildKnowledgeReconcileSql())
console.log('\n✔ knowledge corpus reconciled')

if (!remote) {
  // No local Vectorize exists to embed into (it has no local-dev mode at
  // all), and a local sync or the test suite must never need Workers AI
  // network access or `wrangler login` — see design.md decision 3.6.
  process.exit(0)
}

console.log('\n▶ embedding changed chunks → Vectorize (jaime-knowledge)\n')

const { env, dispose } = await getPlatformProxy({
  configPath: fileURLToPath(new URL('./knowledge-search.wrangler.jsonc', import.meta.url)),
})

try {
  const { chunks } = readCorpus()
  const existingHashes = readExistingHashes()
  const { summary, updatedHashes, deletedIds } = await embedAndUpsert(env.AI, env.VECTORIZE, existingHashes, chunks)

  console.log(`embedded: ${summary.embedded}, skipped (unchanged): ${summary.skipped}, deleted: ${summary.deleted}, truncated: ${summary.truncated}`)

  if (updatedHashes.length > 0 || deletedIds.length > 0) {
    runD1File(toEmbeddingTrackingSql(updatedHashes, deletedIds, new Date().toISOString()))
  }

  console.log('\n✔ knowledge search index reconciled')
}
finally {
  await dispose()
}
