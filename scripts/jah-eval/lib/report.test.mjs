import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  buildReport,
  compare,
  formatCompare,
  formatSummary,
  getRevision,
  loadBaseline,
  saveBaseline,
  saveReport,
  shortHash,
  stripForBaseline,
  summarize,
  unavailableChecks,
} from './report.mjs'

function sample(caseId, kind, sampleIndex, verdict, extra = {}) {
  return { caseId, kind, sampleIndex, verdict, reply: `reply for ${caseId} #${sampleIndex}`, ...extra }
}

test('summarize() counts per kind and overall, with a pass rate', () => {
  const results = [
    sample('d1', 'docs', 0, 'pass'),
    sample('d1', 'docs', 1, 'fail', { checks: { expect: { result: 'fail', missing: ['fast'] } } }),
    sample('f1', 'fix', 0, 'pass'),
  ]
  const s = summarize(results)
  assert.equal(s.overall.total, 3)
  assert.equal(s.overall.pass, 2)
  assert.equal(s.overall.fail, 1)
  assert.equal(s.overall.passRate, 2 / 3)
  assert.equal(s.perKind.docs.total, 2)
  assert.equal(s.perKind.docs.passRate, 0.5)
  assert.equal(s.perKind.fix.passRate, 1)
})

test('summarize() names each failing sample and its reason', () => {
  const results = [sample('d1', 'docs', 0, 'fail', { checks: { expect: { result: 'fail', missing: ['fast'] } } })]
  const s = summarize(results)
  assert.equal(s.failingCases.d1.length, 1)
  assert.match(s.failingCases.d1[0].reason, /expect/)
})

test('summarize() gives every case a pass rate; an errored sample counts against it', () => {
  const results = [sample('d1', 'docs', 0, 'pass'), sample('d1', 'docs', 1, 'error', { modelError: 'timeout' })]
  const s = summarize(results)
  assert.equal(s.casePassRates.d1, 0.5)
})

test('summarize() rejects an unrecognised verdict rather than silently ignoring it', () => {
  assert.throws(() => summarize([sample('d1', 'docs', 0, 'maybe')]))
})

test('unavailableChecks() reports the function-existence check while there is no index', () => {
  const results = [sample('d1', 'docs', 0, 'pass', { checks: { functionExistence: { result: 'unavailable', reason: 'no index yet' } } })]
  assert.deepEqual(unavailableChecks(results), [{ check: 'functionExistence', reason: 'no index yet' }])
})

test('unavailableChecks() de-duplicates the same reason across many samples', () => {
  const results = [
    sample('d1', 'docs', 0, 'pass', { checks: { functionExistence: { result: 'unavailable', reason: 'x' } } }),
    sample('d1', 'docs', 1, 'pass', { checks: { functionExistence: { result: 'unavailable', reason: 'x' } } }),
  ]
  assert.equal(unavailableChecks(results).length, 1)
})

test('shortHash() is deterministic and sensitive to its input', () => {
  assert.equal(shortHash('a'), shortHash('a'))
  assert.notEqual(shortHash('a'), shortHash('b'))
})

test('getRevision() returns a short sha, optionally +dirty, from this real repo', () => {
  const rev = getRevision()
  assert.match(rev, /^[0-9a-f]{6,}(\+dirty)?$|^unknown$/)
})

test('buildReport() fingerprints the prompt and embeds the summary', () => {
  const report = buildReport({
    ranAt: '2026-01-01T00:00:00.000Z',
    model: 'test-model',
    systemPrompt: 'be nice',
    caseSetFingerprint: 'abc123',
    samples: 2,
    revision: 'deadbeef',
    results: [sample('d1', 'docs', 0, 'pass')],
  })
  assert.equal(report.promptFingerprint, shortHash('be nice'))
  assert.equal(report.summary.overall.total, 1)
  assert.deepEqual(report.unavailable, [])
})

test('stripForBaseline() drops reply text but keeps the verdicts', () => {
  const report = buildReport({
    ranAt: 't', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c', samples: 1, revision: 'r',
    results: [sample('d1', 'docs', 0, 'pass')],
  })
  const stripped = stripForBaseline(report)
  assert.equal(stripped.results[0].reply, undefined)
  assert.equal(stripped.results[0].verdict, 'pass')
  assert.equal(stripped.summary.overall.total, 1)
})

test('formatSummary() names each failing case', () => {
  const report = buildReport({
    ranAt: 't', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c', samples: 1, revision: 'r',
    results: [sample('d1', 'docs', 0, 'fail', { checks: { expect: { result: 'fail', missing: ['fast'] } } })],
  })
  const text = formatSummary(report)
  assert.match(text, /failing cases:/)
  assert.match(text, /d1 \[sample 0\]/)
})

test('saveReport() writes outside the repo by default and leaves nothing to clean up in-tree', () => {
  const report = buildReport({ ranAt: '2026-01-01T00-00-00', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c', samples: 1, revision: 'r', results: [] })
  const dest = saveReport(report)
  assert.ok(dest.startsWith(tmpdir()))
  assert.deepEqual(JSON.parse(readFileSync(dest, 'utf8')).model, 'm')
})

test('a case that newly passes is reported as a rise, and the baseline round-trips through disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jah-eval-test-'))
  const baselinePath = join(dir, 'baseline.json')

  const before = buildReport({
    ranAt: 't0', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c', samples: 1, revision: 'r0',
    results: [sample('d1', 'docs', 0, 'fail', { checks: { expect: { result: 'fail', missing: ['fast'] } } })],
  })
  saveBaseline(before, baselinePath)
  const baseline = loadBaseline(baselinePath)

  const after = buildReport({
    ranAt: 't1', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c', samples: 1, revision: 'r1',
    results: [sample('d1', 'docs', 0, 'pass')],
  })

  const cmp = compare(after, baseline)
  assert.equal(cmp.overall.before, 0)
  assert.equal(cmp.overall.after, 1)
  assert.deepEqual(cmp.casesChanged, [{ id: 'd1', before: 0, after: 1 }])
  assert.deepEqual(cmp.onlyInRun, [])
  assert.deepEqual(cmp.onlyInBaseline, [])
  assert.match(formatCompare(cmp), /d1: 0% → 100%/)
})

test('a differing system prompt is stated, not hidden, and comparison is not refused', () => {
  const baseline = buildReport({ ranAt: 't0', model: 'm', systemPrompt: 'old prompt', caseSetFingerprint: 'c', samples: 1, revision: 'r0', results: [sample('d1', 'docs', 0, 'pass')] })
  const run = buildReport({ ranAt: 't1', model: 'm', systemPrompt: 'new prompt', caseSetFingerprint: 'c', samples: 1, revision: 'r1', results: [sample('d1', 'docs', 0, 'pass')] })
  const cmp = compare(run, baseline)
  assert.equal(cmp.promptChanged, true)
  assert.match(formatCompare(cmp), /system prompt/)
})

test('a case present in only one run is listed, not counted as a change', () => {
  const baseline = buildReport({ ranAt: 't0', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c1', samples: 1, revision: 'r0', results: [sample('old-case', 'docs', 0, 'pass')] })
  const run = buildReport({ ranAt: 't1', model: 'm', systemPrompt: 'p', caseSetFingerprint: 'c2', samples: 1, revision: 'r1', results: [sample('new-case', 'docs', 0, 'pass')] })
  const cmp = compare(run, baseline)
  assert.deepEqual(cmp.onlyInRun, ['new-case'])
  assert.deepEqual(cmp.onlyInBaseline, ['old-case'])
  assert.deepEqual(cmp.casesChanged, [])
})
