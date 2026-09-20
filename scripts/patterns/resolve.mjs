#!/usr/bin/env node
// Resolve a source to Strudel code candidates (the add-patterns skill's
// "Resolve" step). Prints JSON; never writes anything.
//
//   node scripts/patterns/resolve.mjs <source> [--source-url <url>]
//
// <source>  a strudel.cc link (#<base64> or ?<short>), a raw/gist/GitHub
//           blob URL, a GitHub repository or directory URL, a local file,
//           or `-` for code on stdin.
// --source-url  where a file/stdin/pasted code came from (required for
//           those; URLs are their own source).
//
// stdout: { ok: true, candidates, skipped, notes } | { ok: false, reason, message }
// exit:   0 resolved · 3 could not resolve (reason says why) · 64 usage

import { pathToFileURL } from 'node:url'
import { resolveSource } from './lib/resolvers.mjs'

async function main(argv) {
  const flag = argv.indexOf('--source-url')
  const sourceUrl = flag !== -1 ? argv[flag + 1] : undefined
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--source-url')
  if (positional.length !== 1) {
    console.error('usage: resolve.mjs <source | -> [--source-url <url>]')
    process.exit(64)
  }
  const result = await resolveSource(positional[0], { sourceUrl })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exit(3)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main(process.argv.slice(2))
