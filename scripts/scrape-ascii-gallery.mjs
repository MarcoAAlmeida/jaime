#!/usr/bin/env node
// Manual, one-off crawl of asciiart.eu into PATTERNS_DB's `ascii_art`
// table (add-ascii-overlay, slice 2). NOT run by `npm run deploy` or
// `db:migrate:*` — it hits a third-party site ~400 times and should
// only ever run when an operator explicitly asks for it:
//
//   node scripts/scrape-ascii-gallery.mjs [-- --local|--remote]
//
// Resumable: progress is checkpointed to .ascii-scrape-checkpoint.json
// (gitignored) after every subcategory page, so an interrupted run
// picks back up without re-fetching what it already has. Re-running to
// completion after a full prior run just re-upserts the same rows.
//
// See openspec/changes/add-ascii-overlay/design.md.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertParsedSubcategory,
  BASE_URL,
  buildInsertSql,
  CATEGORIES,
  extractArtPieces,
  extractSubcategorySlugs,
} from './lib/ascii-gallery-scraper.mjs'

const remote = process.argv.includes('--remote')
const target = remote ? '--remote' : '--local'
const CHECKPOINT_FILE = '.ascii-scrape-checkpoint.json'
const REQUEST_DELAY_MS = 600
const BATCH_SIZE = 250
const USER_AGENT = 'Mozilla/5.0 (compatible; jaime-ascii-scrape/1.0; +https://jaime.stream)'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPage(url, attempt = 1) {
  let res
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  }
  catch (err) {
    if (attempt < 4) {
      await sleep(1500 * attempt)
      return fetchPage(url, attempt + 1)
    }
    throw new Error(`${url}: fetch failed after ${attempt} attempts (${err.message})`)
  }
  if (res.status === 404) return null
  if (!res.ok) {
    if (attempt < 4) {
      await sleep(1500 * attempt)
      return fetchPage(url, attempt + 1)
    }
    throw new Error(`${url}: HTTP ${res.status} after ${attempt} attempts`)
  }
  return res.text()
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_FILE)) return { done: {}, pieces: [] }
  try {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'))
  }
  catch {
    console.warn(`⚠ ${CHECKPOINT_FILE} is corrupt — starting fresh`)
    return { done: {}, pieces: [] }
  }
}

function saveCheckpoint(state) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(state))
}

function applyBatch(sql) {
  const file = join(mkdtempSync(join(tmpdir(), 'jaime-ascii-')), 'batch.sql')
  writeFileSync(file, sql)
  const args = ['wrangler', 'd1', 'execute', 'PATTERNS_DB', target, '--file', file]
  if (remote) args.push('--yes')
  const res = spawnSync('npx', args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
    env: { ...process.env, CI: '1' },
  })
  if (res.status !== 0) throw new Error(`wrangler d1 execute failed (exit ${res.status ?? 'signal'})`)
}

async function main() {
  console.log(`\n▶ scraping asciiart.eu → PATTERNS_DB.ascii_art (${target})\n`)

  const state = loadCheckpoint()
  let newPieces = 0

  for (const category of CATEGORIES) {
    const categoryHtml = await fetchPage(`${BASE_URL}/${category}`)
    await sleep(REQUEST_DELAY_MS)
    if (!categoryHtml) {
      console.warn(`⚠ ${category}: category page not found, skipping`)
      continue
    }

    const subcategories = extractSubcategorySlugs(categoryHtml, category)
    if (subcategories.length === 0) {
      console.warn(`⚠ ${category}: no subcategories found — check the parser if this is unexpected`)
      continue
    }

    for (const subcategory of subcategories) {
      const key = `${category}/${subcategory}`
      if (state.done[key]) continue

      const html = await fetchPage(`${BASE_URL}/${key}`)
      await sleep(REQUEST_DELAY_MS)
      if (!html) {
        console.warn(`⚠ ${key}: page not found, skipping`)
        state.done[key] = true
        continue
      }

      const pieces = extractArtPieces(html, category, subcategory)
      assertParsedSubcategory({ html, pieces, category, subcategory })

      state.pieces.push(...pieces)
      state.done[key] = true
      newPieces += pieces.length
      saveCheckpoint(state)
      console.log(`  ${key}: ${pieces.length} pieces (${state.pieces.length} total so far)`)
    }
  }

  console.log(`\n✓ crawl complete: ${state.pieces.length} pieces total (${newPieces} fetched this run)\n`)

  const scrapedAt = new Date().toISOString()
  for (let i = 0; i < state.pieces.length; i += BATCH_SIZE) {
    const batch = state.pieces.slice(i, i + BATCH_SIZE)
    console.log(`▶ applying rows ${i + 1}-${i + batch.length} of ${state.pieces.length}`)
    applyBatch(buildInsertSql(batch, scrapedAt))
  }

  console.log('\n✓ all rows applied')
}

main().catch((err) => {
  console.error(`\n✖ ${err.message}\n`)
  process.exit(1)
})
