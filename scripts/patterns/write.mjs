#!/usr/bin/env node
// Write curated patterns into content/patterns/*.md — the only thing the
// add-patterns skill ever changes (add-pattern-ingestion-skill, design 1, 4, 8).
//
//   node scripts/patterns/write.mjs <spec.json | -> [--update] [--dry-run]
//                                   [--no-sync] [--dir <manifest dir>]
//
// The spec is one object or an array of:
//   { title, sourceUrl, code, tags?, author?, favorite?, id?, createdAt? }
//
// Rules:
//  - Code goes in exactly as given (fence-length-safe); only line endings
//    → LF and blank edges are normalised (see normalizeCode).
//  - A pattern already in the library is recognised by its source URL and
//    keeps its id. Same content → `unchanged`; different → `would-update`
//    unless --update. An id that is taken by a *different* source is a
//    `collision` and nothing is written.
//  - Every file is validated by re-reading the whole manifest; a file that
//    would make it invalid is rolled back and reported as `invalid`.
//  - Writes files only. Unless --no-sync it then syncs the LOCAL database
//    (npm run patterns:sync, never --remote) so the result shows locally.
//
// Output (stdout): { results: [{ id, action, path?, changes?, message? }] }
// actions: created | updated | unchanged | would-create | would-update |
//          collision | invalid.   Exit 2 if any collision/invalid.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Document, isSeq } from 'yaml'
import { fenceFor, MANIFEST_DIR, ManifestError, normalizeCode, readManifest } from '../lib/patterns-manifest.mjs'

/** kebab-case id from a title: lowercase, no diacritics, [a-z0-9-]. */
export function slugify(text) {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/**
 * The manifest file text for one pattern.
 * @param {{ title: string, sourceUrl: string, code: string, tags?: string[], author?: string | null, favorite?: boolean, createdAt?: string }} p
 */
export function renderPattern(p) {
  const fm = { title: p.title, tags: p.tags ?? [], source_url: p.sourceUrl }
  if (p.author) fm.source_author = p.author
  if (p.favorite) fm.favorite = true
  if (p.createdAt) fm.created_at = p.createdAt
  const doc = new Document(fm)
  const tags = doc.get('tags', true)
  if (isSeq(tags)) tags.flow = true // `tags: [a, b]`, like the existing files
  const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false }).trimEnd()
  const code = normalizeCode(p.code)
  const fence = fenceFor(code)
  return `---\n${yaml}\n---\n\n${fence}strudel\n${code}\n${fence}\n`
}

function validateSpec(spec) {
  const problems = []
  if (!spec || typeof spec !== 'object') return ['spec must be an object']
  if (typeof spec.title !== 'string' || !spec.title.trim()) problems.push('title is required')
  if (typeof spec.sourceUrl !== 'string' || !/^https?:\/\/\S+$/.test(spec.sourceUrl.trim())) problems.push('sourceUrl must be an http(s) URL — a pattern is never added without one')
  if (typeof spec.code !== 'string' || !normalizeCode(spec.code)) problems.push('code is required')
  if (spec.tags != null && (!Array.isArray(spec.tags) || spec.tags.some(t => typeof t !== 'string' || !t.trim()))) problems.push('tags must be a list of non-empty strings')
  if (spec.id != null && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.id)) problems.push('id must be kebab-case (a-z, 0-9, -)')
  return problems
}

/** Which fields differ between the manifest entry and the incoming spec. */
function differences(existing, spec) {
  const changes = []
  if (normalizeCode(spec.code) !== existing.code) changes.push('code')
  if (spec.title.trim() !== existing.title) changes.push('title')
  const a = [...(spec.tags ?? [])].map(t => t.trim()).sort().join('\n')
  const b = [...existing.tags].sort().join('\n')
  if (spec.tags != null && a !== b) changes.push('tags')
  if (spec.author !== undefined && (spec.author?.trim() || null) !== existing.sourceAuthor) changes.push('author')
  if (spec.favorite !== undefined && !!spec.favorite !== existing.favorite) changes.push('favorite')
  return changes
}

/**
 * @param {object[]} specs
 * @param {{ dir?: string, update?: boolean, dryRun?: boolean, now?: number }} [options]
 * @returns {{ id: string, action: string, path?: string, changes?: string[], message?: string, problems?: string[] }[]}
 */
export function writePatterns(specs, options = {}) {
  const dir = options.dir ?? MANIFEST_DIR
  const now = options.now ?? Date.now()
  const results = []

  for (const [i, spec] of specs.entries()) {
    const problems = validateSpec(spec)
    const label = spec?.id ?? (typeof spec?.title === 'string' ? slugify(spec.title) : `#${i + 1}`)
    if (problems.length) {
      results.push({ id: label, action: 'invalid', problems, message: problems.join('; ') })
      continue
    }

    const sourceUrl = spec.sourceUrl.trim()
    let entries
    try {
      entries = readManifest(dir)
    }
    catch (err) {
      if (err instanceof ManifestError) return [...results, { id: label, action: 'invalid', problems: err.problems, message: 'the existing manifest is already invalid; fix it first' }]
      throw err
    }

    const existing = entries.find(e => e.sourceUrl === sourceUrl)
    if (existing) {
      const changes = differences(existing, spec)
      const path = join(dir, `${existing.id}.md`)
      if (changes.length === 0) {
        results.push({ id: existing.id, action: 'unchanged', path })
        continue
      }
      if (!options.update || options.dryRun) {
        results.push({ id: existing.id, action: 'would-update', path, changes })
        continue
      }
      const original = readFileSync(path, 'utf8')
      writeFileSync(path, renderPattern({
        title: spec.title.trim(),
        tags: spec.tags ?? existing.tags,
        sourceUrl,
        author: spec.author !== undefined ? spec.author : existing.sourceAuthor,
        favorite: spec.favorite !== undefined ? !!spec.favorite : existing.favorite,
        createdAt: existing.createdAt,
        code: spec.code,
      }))
      try {
        readManifest(dir)
      }
      catch (err) {
        writeFileSync(path, original)
        results.push({ id: existing.id, action: 'invalid', path, problems: err.problems ?? [String(err)], message: 'rolled back' })
        continue
      }
      results.push({ id: existing.id, action: 'updated', path, changes })
      continue
    }

    const id = spec.id ?? slugify(spec.title)
    if (!id) {
      results.push({ id: label, action: 'invalid', problems: ['cannot derive an id from the title; pass id'], message: 'cannot derive an id from the title' })
      continue
    }
    const path = join(dir, `${id}.md`)
    if (existsSync(path)) {
      results.push({ id, action: 'collision', path, message: `id '${id}' is already used by a pattern with a different source; choose another id (e.g. '${id}-2')` })
      continue
    }
    if (options.dryRun) {
      results.push({ id, action: 'would-create', path })
      continue
    }
    // Newer than everything already there; a batch keeps its order.
    const createdAt = spec.createdAt ?? new Date(now + i * 1000).toISOString()
    writeFileSync(path, renderPattern({
      title: spec.title.trim(),
      tags: spec.tags ?? [],
      sourceUrl,
      author: spec.author ?? null,
      favorite: !!spec.favorite,
      createdAt,
      code: spec.code,
    }))
    try {
      readManifest(dir)
    }
    catch (err) {
      unlinkSync(path)
      results.push({ id, action: 'invalid', path, problems: err.problems ?? [String(err)], message: 'rolled back' })
      continue
    }
    results.push({ id, action: 'created', path })
  }
  return results
}

function syncLocalDatabase() {
  const r = spawnSync(process.execPath, ['scripts/sync-patterns.mjs'], { encoding: 'utf8' })
  return { ok: r.status === 0, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() }
}

function readSpecs(source) {
  const raw = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function main(argv) {
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--dir')
  if (positional.length !== 1) {
    console.error('usage: write.mjs <spec.json | -> [--update] [--dry-run] [--no-sync] [--dir <dir>]')
    process.exit(64)
  }
  const dirFlag = argv.indexOf('--dir')
  const dir = dirFlag !== -1 ? argv[dirFlag + 1] : MANIFEST_DIR
  const results = writePatterns(readSpecs(positional[0]), { dir, update: argv.includes('--update'), dryRun: argv.includes('--dry-run') })

  const changed = results.some(r => r.action === 'created' || r.action === 'updated')
  let sync
  if (changed && !argv.includes('--no-sync')) sync = syncLocalDatabase()

  console.log(JSON.stringify({ results, ...(sync ? { sync } : {}) }, null, 2))
  if (results.some(r => r.action === 'collision' || r.action === 'invalid') || (sync && !sync.ok)) process.exit(2)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2))
