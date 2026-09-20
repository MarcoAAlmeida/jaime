#!/usr/bin/env node
// The library's tag vocabulary, from the manifest: every tag in use with
// how many patterns carry it, most-used first. The add-patterns skill
// reuses these rather than inventing near-duplicates (add-pattern-ingestion-
// skill, design decision 1).
//
//   node scripts/patterns/tags.mjs          → JSON on stdout
//   node scripts/patterns/tags.mjs --text   → "count  tag" lines

import { pathToFileURL } from 'node:url'
import { MANIFEST_DIR, readManifest } from '../lib/patterns-manifest.mjs'

/**
 * @param {{ tags: string[] }[]} entries
 * @returns {{ tag: string, count: number }[]}
 */
export function tagCounts(entries) {
  const counts = new Map()
  for (const e of entries) {
    for (const tag of new Set(e.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

function main(argv) {
  const dirFlag = argv.indexOf('--dir')
  const dir = dirFlag !== -1 ? argv[dirFlag + 1] : MANIFEST_DIR
  const tags = tagCounts(readManifest(dir))
  if (argv.includes('--text')) {
    for (const { tag, count } of tags) console.log(`${String(count).padStart(4)}  ${tag}`)
  }
  else {
    console.log(JSON.stringify({ tags }, null, 2))
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2))
