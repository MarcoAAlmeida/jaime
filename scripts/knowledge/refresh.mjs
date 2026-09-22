#!/usr/bin/env node
// Turns Strudel's own documentation (refers_to/strudel, at its pinned
// commit) into content/knowledge/strudel.json — the deliberate, manual
// refresh add-strudel-knowledge-corpus adds. NEVER run by `npm test`,
// `npm run deploy`, or CI (spec: "Refreshing Is A Deliberate, Offline-Safe,
// Developer-Run Act"). See design.md decision 9 for the pipeline order and
// docs/04-roadmap/jah-intelligence/phase-1-knows-strudel.md for context.
//
//   node scripts/knowledge/refresh.mjs [--skip-submodule-update] [--out <file>]
//
// The first real run does a one-time `git submodule update --init` and a
// one-time `npm install` scoped to refers_to/strudel's own node_modules
// (design.md decision 3) — both no-cost, no-CI-impact, one-time steps.

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createTriage } from '../patterns/lib/triage.mjs'
import { buildCategoryMap, listPages, parsePage } from './lib/pages.mjs'
import { assembleCorpus, buildConceptAndExampleChunks, buildFunctionChunks } from './lib/chunks.mjs'
import { validateCorpus } from './lib/validate.mjs'
import { loadUndocumentedGaps } from './lib/gaps.mjs'
import { ensureJsdocTooling, ensureSubmodule, SUBMODULE_PATH } from './lib/submodule.mjs'
import { extractDoclets } from './lib/jsdoc.mjs'
import { writeCorpus } from './lib/write.mjs'

const execFileAsync = promisify(execFile)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
function flag(name) {
  return process.argv.includes(`--${name}`)
}

const OUT_PATH = arg('out', 'content/knowledge/strudel.json')

async function submoduleCommit() {
  const { stdout } = await execFileAsync('git', ['-C', SUBMODULE_PATH, 'rev-parse', '--short=7', 'HEAD'])
  return stdout.trim()
}

/** Read from OUR OWN installed packages — pinned to match the submodule (README decision 1). */
function strudelVersions() {
  const versionOf = pkg => JSON.parse(readFileSync(`node_modules/@strudel/${pkg}/package.json`, 'utf8')).version
  return { core: versionOf('core'), webaudio: versionOf('webaudio'), codemirror: versionOf('codemirror') }
}

function readPageText(pagesRoot, relPath) {
  return readFileSync(join(pagesRoot, ...relPath.split('/')), 'utf8')
}

async function main() {
  if (!flag('skip-submodule-update')) {
    console.log(`Ensuring ${SUBMODULE_PATH} is at its pinned commit...`)
    await ensureSubmodule()
  }
  console.log('Ensuring jsdoc/jsdoc-json are installed inside the submodule...')
  await ensureJsdocTooling()

  console.log('Extracting JSDoc...')
  const doclets = await extractDoclets(SUBMODULE_PATH)
  console.log(`  ${doclets.length} documented functions`)

  console.log('Parsing documentation pages...')
  const pagesRoot = join(SUBMODULE_PATH, 'website', 'src', 'pages')
  const pagePaths = listPages(pagesRoot)
  const pages = pagePaths.map(p => ({ path: p, parsed: parsePage(p, readPageText(pagesRoot, p)) }))
  const pageWarnings = pages.flatMap(({ path, parsed }) => parsed.warnings.map(w => `${path}: ${w}`))
  const { categoryByFunction, warnings: categoryWarnings } = buildCategoryMap(pages)
  console.log(`  ${pages.length} pages, ${categoryByFunction.size} functions categorized`)

  const commit = await submoduleCommit()
  const functionResult = buildFunctionChunks(doclets, categoryByFunction, { commit })
  const conceptResult = buildConceptAndExampleChunks(pages, { commit })
  const { chunks, gaps: categoryGaps, collisions } = assembleCorpus(functionResult, conceptResult)

  console.log(`Validating ${chunks.length} chunks...`)
  const triage = await createTriage()
  let snapshotText = null
  try {
    snapshotText = readFileSync(join(SUBMODULE_PATH, 'test', '__snapshots__', 'examples.test.mjs.snap'), 'utf8')
  }
  catch {
    console.log('  (no Strudel example snapshot found — skipping the exact-output comparison, playability is still checked)')
  }
  const queryFn = snapshotText ? code => triage.queryEvents(code, 4) : undefined
  const validation = await validateCorpus(chunks, { triage, snapshotText, queryFn })

  let undocumentedGaps = []
  try {
    undocumentedGaps = loadUndocumentedGaps(join(SUBMODULE_PATH, 'undocumented.json'))
  }
  catch {
    console.log('  (no undocumented.json found in the submodule — skipping that gap report)')
  }

  const report = {
    generatedAt: new Date().toISOString(),
    submoduleCommit: commit,
    strudelVersions: strudelVersions(),
    chunks,
    gaps: [...categoryGaps, ...undocumentedGaps],
    validation,
  }

  writeCorpus(OUT_PATH, report)

  const countOf = kind => chunks.filter(c => c.kind === kind).length
  console.log('')
  console.log(`chunks: ${chunks.length} (function: ${countOf('function')}, concept: ${countOf('concept')}, example: ${countOf('example')})`)
  console.log(`gaps: ${report.gaps.length}`)
  console.log(`validation issues: ${validation.length}`)
  const warnings = [...pageWarnings, ...categoryWarnings]
  if (warnings.length > 0) {
    console.log(`page-parsing warnings: ${warnings.length}`)
    for (const w of warnings) console.log(`  ${w}`)
  }
  if (collisions.length > 0) {
    console.log(`id collisions: ${collisions.length}`)
    for (const c of collisions) console.log(`  ${c}`)
  }
  console.log(`written: ${OUT_PATH}`)
}

await main()
