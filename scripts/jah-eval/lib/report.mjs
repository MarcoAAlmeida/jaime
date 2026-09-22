// Report, baseline and comparison (add-jah-eval-harness tasks 5.1-5.2).
// Pure functions over a `results` array (see run.mjs for the shape each
// result takes) plus small, injectable wrappers around git and the
// filesystem, so summarizing and comparing are testable with fabricated
// data and no model, network or real git repository required.

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const VERDICTS = ['pass', 'fail', 'inconclusive', 'error']

function emptyCounts() {
  return { pass: 0, fail: 0, inconclusive: 0, error: 0, total: 0 }
}

function passRate(counts) {
  return counts.total ? counts.pass / counts.total : null
}

/** Why one sample of one case failed, from its checks (or the model error when there are none). */
function failureReason(r) {
  if (!r.checks) return r.modelError ?? 'model call failed'
  const failed = Object.entries(r.checks).filter(([, v]) => v.result === 'fail')
  return failed.length > 0 ? failed.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('; ') : 'unknown'
}

/**
 * Counts, per kind and overall, plus each case's pass rate (its passing
 * samples over all its samples — an errored sample counts against it) and
 * every case with a failing sample, with why.
 *
 * @param {Array<{caseId:string, kind:string, sampleIndex:number, verdict:'pass'|'fail'|'inconclusive'|'error', checks?:object, modelError?:string}>} results
 */
export function summarize(results) {
  const overall = emptyCounts()
  const perKind = {}
  const samplesByCase = new Map()
  const failingCases = new Map()

  for (const r of results) {
    if (!VERDICTS.includes(r.verdict)) throw new Error(`unknown verdict "${r.verdict}" for case "${r.caseId}"`)
    overall.total++
    overall[r.verdict]++
    perKind[r.kind] ??= emptyCounts()
    perKind[r.kind].total++
    perKind[r.kind][r.verdict]++

    if (!samplesByCase.has(r.caseId)) samplesByCase.set(r.caseId, [])
    samplesByCase.get(r.caseId).push(r.verdict)

    if (r.verdict === 'fail') {
      if (!failingCases.has(r.caseId)) failingCases.set(r.caseId, [])
      failingCases.get(r.caseId).push({ sampleIndex: r.sampleIndex, reason: failureReason(r) })
    }
  }

  const casePassRates = Object.fromEntries(
    [...samplesByCase].map(([id, verdicts]) => [id, verdicts.filter(v => v === 'pass').length / verdicts.length]),
  )

  return {
    overall: { ...overall, passRate: passRate(overall) },
    perKind: Object.fromEntries(Object.entries(perKind).map(([k, c]) => [k, { ...c, passRate: passRate(c) }])),
    casePassRates,
    failingCases: Object.fromEntries(failingCases),
  }
}

/** Every distinct reason a check could not be run at all (e.g. function-existence with no docs index yet). */
export function unavailableChecks(results) {
  const seen = new Map()
  for (const r of results) {
    for (const [check, outcome] of Object.entries(r.checks ?? {})) {
      if (outcome?.result === 'unavailable') seen.set(`${check}\u0000${outcome.reason}`, { check, reason: outcome.reason })
    }
  }
  return [...seen.values()]
}

/** Short, stable fingerprint of arbitrary text (the system prompt) — same idea as cases.mjs's case-set fingerprint. */
export function shortHash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12)
}

/** The current commit, with `+dirty` appended when the working tree has changes; `unknown` outside a git checkout. */
export function getRevision(cwd = process.cwd()) {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const dirty = execSync('git status --porcelain', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0
    return dirty ? `${sha}+dirty` : sha
  }
  catch {
    return 'unknown'
  }
}

/**
 * Assembles the full report: run details plus the summary and the raw
 * per-sample results (kept, so a saved report can be inspected in full;
 * `stripForBaseline` is what drops the bulky reply text for the committed
 * baseline).
 */
export function buildReport({ ranAt, model, systemPrompt, caseSetFingerprint, samples, revision, results }) {
  return {
    version: 1,
    ranAt,
    model,
    promptFingerprint: shortHash(systemPrompt),
    caseSetFingerprint,
    samples,
    revision,
    summary: summarize(results),
    unavailable: unavailableChecks(results),
    results,
  }
}

/** The report without reply texts (and so without the code blocks inside them) — what the committed baseline holds. */
export function stripForBaseline(report) {
  return { ...report, results: report.results.map(({ reply, ...rest }) => rest) }
}

function pct(n, total) {
  return total ? `${Math.round((n / total) * 100)}%` : 'n/a'
}

function countsLine(label, c) {
  return `${label.padEnd(10)} n=${String(c.total).padEnd(4)} pass ${pct(c.pass, c.total).padEnd(5)} fail ${pct(c.fail, c.total).padEnd(5)} inconclusive ${pct(c.inconclusive, c.total).padEnd(5)} error ${pct(c.error, c.total)}`
}

/** A human-readable summary, printed by run.mjs (kept a pure string builder so tests can assert on it directly). */
export function formatSummary(report) {
  const lines = []
  lines.push(`@jah eval — ${report.ranAt} — model ${report.model} — revision ${report.revision}`)
  lines.push(`prompt ${report.promptFingerprint} · case set ${report.caseSetFingerprint} · ${report.samples} samples/case`)
  lines.push('')
  lines.push(countsLine('overall', report.summary.overall))
  for (const [kind, c] of Object.entries(report.summary.perKind)) lines.push(countsLine(kind, c))

  if (report.unavailable.length > 0) {
    lines.push('')
    lines.push('unavailable checks:')
    for (const u of report.unavailable) lines.push(`  ${u.check}: ${u.reason}`)
  }

  const failing = Object.entries(report.summary.failingCases)
  if (failing.length > 0) {
    lines.push('')
    lines.push('failing cases:')
    for (const [id, samples] of failing) for (const s of samples) lines.push(`  ${id} [sample ${s.sampleIndex}]: ${s.reason}`)
  }
  return lines.join('\n')
}

/**
 * How `run` differs from `baseline`: the pass-rate change per kind and
 * overall, the cases whose pass rate moved, cases present in only one of
 * the two (never counted as a change), and a plain statement of what else
 * differs between the two runs.
 */
export function compare(run, baseline) {
  const kinds = new Set([...Object.keys(run.summary.perKind), ...Object.keys(baseline.summary.perKind)])
  const perKind = {}
  for (const k of kinds) {
    const before = baseline.summary.perKind[k]?.passRate ?? null
    const after = run.summary.perKind[k]?.passRate ?? null
    perKind[k] = { before, after, delta: before !== null && after !== null ? after - before : null }
  }

  const runIds = new Set(Object.keys(run.summary.casePassRates))
  const baseIds = new Set(Object.keys(baseline.summary.casePassRates))
  const onlyInRun = [...runIds].filter(id => !baseIds.has(id))
  const onlyInBaseline = [...baseIds].filter(id => !runIds.has(id))
  const casesChanged = [...runIds]
    .filter(id => baseIds.has(id) && run.summary.casePassRates[id] !== baseline.summary.casePassRates[id])
    .map(id => ({ id, before: baseline.summary.casePassRates[id], after: run.summary.casePassRates[id] }))

  return {
    promptChanged: run.promptFingerprint !== baseline.promptFingerprint,
    caseSetChanged: run.caseSetFingerprint !== baseline.caseSetFingerprint,
    modelChanged: run.model !== baseline.model,
    samplesChanged: run.samples !== baseline.samples,
    overall: {
      before: baseline.summary.overall.passRate,
      after: run.summary.overall.passRate,
      delta: run.summary.overall.passRate - baseline.summary.overall.passRate,
    },
    perKind,
    casesChanged,
    onlyInRun,
    onlyInBaseline,
  }
}

function fmtRate(r) {
  return r === null ? 'n/a' : `${Math.round(r * 100)}%`
}

/** A human-readable comparison, printed by run.mjs's --compare. */
export function formatCompare(cmp) {
  const lines = []
  lines.push(`overall: ${fmtRate(cmp.overall.before)} → ${fmtRate(cmp.overall.after)}`)
  for (const [kind, d] of Object.entries(cmp.perKind)) lines.push(`  ${kind}: ${fmtRate(d.before)} → ${fmtRate(d.after)}`)

  if (cmp.casesChanged.length > 0) {
    lines.push('')
    lines.push('cases whose pass rate moved:')
    for (const c of cmp.casesChanged) lines.push(`  ${c.id}: ${fmtRate(c.before)} → ${fmtRate(c.after)}`)
  }
  if (cmp.onlyInRun.length > 0) lines.push(`not in the baseline (not counted as a change): ${cmp.onlyInRun.join(', ')}`)
  if (cmp.onlyInBaseline.length > 0) lines.push(`not in this run (not counted as a change): ${cmp.onlyInBaseline.join(', ')}`)

  const differs = []
  if (cmp.promptChanged) differs.push('system prompt')
  if (cmp.caseSetChanged) differs.push('case set')
  if (cmp.modelChanged) differs.push('model')
  if (cmp.samplesChanged) differs.push('sample count')
  if (differs.length > 0) lines.push(`differs from the baseline in: ${differs.join(', ')}`)
  return lines.join('\n')
}

/** Writes `report` to `outPath`, or a timestamped file in the OS temp directory when none is given. Returns the path written. */
export function saveReport(report, outPath) {
  const dest = outPath ?? join(tmpdir(), `jah-eval-${report.ranAt.replace(/[^0-9a-zA-Z]/g, '-')}.json`)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, JSON.stringify(report, null, 2))
  return dest
}

export function loadBaseline(baselinePath) {
  return JSON.parse(readFileSync(baselinePath, 'utf8'))
}

export function saveBaseline(report, baselinePath) {
  writeFileSync(baselinePath, JSON.stringify(stripForBaseline(report), null, 2))
}
