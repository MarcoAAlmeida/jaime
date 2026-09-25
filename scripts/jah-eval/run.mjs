#!/usr/bin/env node
// Measures @jah against the committed case set, for real, against the real
// model (add-jah-eval-harness). NOT part of `npm test` or CI — it spends
// real (tiny) money. See ./README.md for the full command reference.
//
//   npx wrangler login                     # once; Workers AI is a remote binding
//   node scripts/jah-eval/run.mjs [--samples 3] [--kinds docs,fix] [--case id1,id2]
//                                  [--out <file>] [--save-baseline] [--compare] [--grounded]
//   node scripts/jah-eval/run.mjs --validate   # no model call; checks the case set itself
//
// --grounded (add-jah-knowledge-retrieval task 6.2) runs each case through
// the real retrieveContext first, the same call shape a live @jah mention
// makes — compare its report against baseline.json (recorded ungrounded)
// to see what grounding changed. Never saved as the baseline itself
// (--save-baseline is for the ungrounded, Phase 0 measurement).
//
// See docs/04-roadmap/jah-intelligence/phase-0-foundations.md and
// openspec/changes/add-jah-eval-harness/design.md for what this measures and why.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { createTriage } from '../patterns/lib/triage.mjs'
import { loadCaseSet } from './lib/cases.mjs'
import { createModelCaller, MODEL, runSamples } from './lib/model.mjs'
import { evaluateReply } from './lib/evaluate.mjs'
import { score } from './lib/score.mjs'
import { loadFunctionIndex } from './lib/functions.mjs'
import {
  buildReport,
  compare,
  formatCompare,
  formatSummary,
  getRevision,
  loadBaseline,
  saveBaseline,
  saveReport,
} from './lib/report.mjs'
// A .ts import; Node's type stripping handles it (see jah-prompt-eval.mjs).
import { JAH_SYSTEM_PROMPT } from '../../server/jah/prompt.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASELINE_PATH = join(HERE, 'baseline.json')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
function flag(name) {
  return process.argv.includes(`--${name}`)
}
function list(value) {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : null
}

function selectCases(cases) {
  const kinds = list(arg('kinds'))
  const ids = list(arg('case'))
  return cases.filter(c => (!kinds || kinds.includes(c.kind)) && (!ids || ids.includes(c.id)))
}

async function runValidate(cases) {
  const fixCases = cases.filter(c => c.kind === 'fix')
  const triage = await createTriage()
  let invalid = 0
  for (const c of fixCases) {
    // Sequential on purpose: triage mutates a shared global, one check at a time.
    const result = await triage.check(c.broken)
    const actual = result.status === 'error' ? result.error : result.status === 'missing-sounds' ? `missing sounds: ${result.missing.join(', ')}` : null
    if (actual === null) {
      invalid++
      console.log(`INVALID  ${c.id}: broken code did not fail (status: ${result.status}) — this case measures nothing until its code actually fails`)
      continue
    }
    console.log(`ok       ${c.id}`)
    console.log(`  stated:  ${c.error}`)
    console.log(`  actual:  ${actual}`)
  }
  console.log(`\n${fixCases.length - invalid}/${fixCases.length} fix cases are genuinely broken.`)
  if (invalid > 0) process.exitCode = 1
}

async function main() {
  const { cases: allCases, problems, fingerprint } = loadCaseSet()
  if (problems.length > 0) {
    console.error('The case set has problems — fix these before running anything:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exitCode = 1
    return
  }

  const cases = selectCases(allCases)
  if (cases.length === 0) {
    console.error('No cases matched --kinds/--case.')
    process.exitCode = 1
    return
  }

  if (flag('validate')) {
    await runValidate(cases)
    return
  }

  const samples = Number(arg('samples', 3))
  const grounded = flag('grounded')
  console.log(`About to make ${cases.length} case(s) × ${samples} sample(s) = ${cases.length * samples} model call(s) against ${MODEL}${grounded ? ' (grounded — retrieveContext runs first)' : ''}.`)

  let env, dispose
  try {
    ({ env, dispose } = await getPlatformProxy({
      configPath: fileURLToPath(new URL('../jah-prompt-eval.wrangler.jsonc', import.meta.url)),
    }))
    if (!env.AI) throw new Error('no AI binding')
    if (grounded && (!env.PATTERNS_DB || !env.VECTORIZE)) throw new Error('no PATTERNS_DB/VECTORIZE binding (needed for --grounded)')
  }
  catch (err) {
    console.error(`Workers AI is not available (${err.message}). Run "npx wrangler login" and try again.`)
    process.exitCode = 1
    return
  }

  try {
    const call = createModelCaller(env, { grounded })
    const raw = await runSamples(cases, { samples, call, concurrency: 4 })

    const casesById = new Map(cases.map(c => [c.id, c]))
    const functionIndex = await loadFunctionIndex()
    const triage = await createTriage()

    const results = []
    for (const r of raw) {
      const c = casesById.get(r.caseId)
      if (r.error) {
        results.push({ caseId: r.caseId, kind: c.kind, sampleIndex: r.sampleIndex, verdict: 'error', modelError: r.error })
        continue
      }
      // Sequential on purpose: triage mutates a shared global, one evaluation at a time.
      const evalOutcome = await evaluateReply(triage, r.reply)
      const scored = score(c, r.reply, evalOutcome, functionIndex)
      results.push({ caseId: r.caseId, kind: c.kind, sampleIndex: r.sampleIndex, verdict: scored.verdict, checks: scored.checks, formatting: scored.formatting, reply: r.reply, evalOutcome })
    }

    const report = buildReport({
      ranAt: new Date().toISOString(),
      model: MODEL,
      // Grounded: the prompt differs per case (retrieved context), so
      // there's no one fingerprint to record — this sentinel makes a
      // grounded report visibly distinct from an ungrounded one at a
      // glance, rather than falsely claiming the plain prompt was used.
      systemPrompt: grounded ? 'grounded (dynamic per case — see retrieveContext)' : JAH_SYSTEM_PROMPT,
      caseSetFingerprint: fingerprint,
      samples,
      revision: getRevision(),
      results,
    })

    console.log('')
    console.log(formatSummary(report))

    const dest = saveReport(report, arg('out'))
    console.log(`\nfull report: ${dest}`)

    if (flag('save-baseline')) {
      saveBaseline(report, BASELINE_PATH)
      console.log(`baseline saved: ${BASELINE_PATH}`)
    }
    if (flag('compare')) {
      const baseline = loadBaseline(BASELINE_PATH)
      console.log('')
      console.log(formatCompare(compare(report, baseline)))
    }
  }
  finally {
    await dispose()
  }
}

await main()
