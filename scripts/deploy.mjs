#!/usr/bin/env node
// Production deploy: build → apply the PATTERNS_DB D1 migrations to the
// remote database → deploy the Worker. Runs as one step so the schema
// is never behind the code.
//
// CI=1 is set so `wrangler d1 migrations apply --remote` skips its
// interactive "database may be unavailable, continue?" prompt — that
// prompt otherwise halts the chain on a normal terminal.

import { spawnSync } from 'node:child_process'

const steps = [
  ['npx', ['nuxt', 'build']],
  ['npx', ['wrangler', 'd1', 'migrations', 'apply', 'PATTERNS_DB', '--remote']],
  ['npx', ['wrangler', 'deploy']],
]

for (const [cmd, args] of steps) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}\n`)
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1' },
  })
  if (res.status !== 0) {
    console.error(`\n✖ step failed (exit ${res.status ?? 'signal'}): ${cmd} ${args.join(' ')}`)
    process.exit(res.status ?? 1)
  }
}

console.log('\n✔ deployed')
