// Orchestration tests: the database and Playwright are injected fakes.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { classify, runCheck, tempRowsSql } from './check.mjs'

describe('classify', () => {
  test('"x is not a function/defined" becomes a dependency, named, and admits it may be a typo', () => {
    const a = classify({ label: 'p', status: 'error', error: 'TypeError: s(...).addeg is not a function' })
    assert.equal(a.status, 'dependency')
    assert.deepEqual(a.depends, ['addeg'])
    assert.match(a.message, /typo/)
    const b = classify({ label: 'p', status: 'error', error: 'ReferenceError: mySynth is not defined' })
    assert.deepEqual([b.status, b.depends], ['dependency', ['mySynth']])
  })
  test('other errors, and non-errors, are left alone', () => {
    const e = { label: 'p', status: 'error', error: 'unexpected token )' }
    assert.deepEqual(classify(e), e)
    const ok = { label: 'p', status: 'pass' }
    assert.deepEqual(classify(ok), ok)
    const m = { label: 'p', status: 'missing-sounds', missingSounds: ['amen'] }
    assert.deepEqual(classify(m), m)
  })
})

describe('tempRowsSql', () => {
  test('inserts user-origin rows and removes them by the same ids; multi-line code stays on one line', () => {
    const { insert, remove } = tempRowsSql([{ id: '__check__a_0', code: 's("bd")\n$: s("sd")' }, { id: '__check__a_1', code: "s('it''s')" }])
    assert.match(insert, /'user', 0\);/)
    assert.equal(insert.trim().split('\n').length, 2, 'one INSERT per line — no raw newline from the code')
    assert.match(insert, /CAST\(x'[0-9a-f]+' AS TEXT\)/)
    assert.match(remove, /DELETE FROM patterns WHERE id IN \('__check__a_0', '__check__a_1'\);/)
    assert.ok(!/origin='curated'/.test(insert + remove), 'never touches curated rows')
  })
})

describe('runCheck (browser tier)', () => {
  const fakeDeps = (report, calls = []) => ({
    execSql: sql => calls.push(['sql', sql]),
    playwright: (ids) => { calls.push(['playwright', ids]); return typeof report === 'function' ? report(ids) : report },
    calls,
  })

  test('stages candidates as temp rows, checks them, and removes the rows after', async () => {
    const deps = fakeDeps(ids => ({ results: ids.map(id => ({ id, title: id, status: 'pass' })) }))
    const out = await runCheck([{ label: 'one', code: 's("bd")' }, { label: 'two', code: 's("sd")' }], { deps })
    assert.deepEqual(out.results.map(r => [r.label, r.status]), [['one', 'pass'], ['two', 'pass']])
    const order = deps.calls.map(c => c[0])
    assert.deepEqual(order, ['sql', 'playwright', 'sql'])
    assert.match(deps.calls[0][1], /^INSERT INTO patterns/)
    assert.match(deps.calls[2][1], /^DELETE FROM pattern_tags/)
    const ids = deps.calls[1][1]
    assert.ok(ids.every(i => i.startsWith('__check__')) && ids.length === 2)
  })

  test('the rows are removed even when the playwright run blows up', async () => {
    const calls = []
    const deps = { execSql: sql => calls.push(sql), playwright: () => { throw new Error('no browser') } }
    await assert.rejects(runCheck([{ label: 'x', code: 's("bd")' }], { deps }), /no browser/)
    assert.equal(calls.length, 2)
    assert.match(calls[1], /DELETE FROM patterns/)
  })

  test('a failing cleanup is a warning, not a lost result', async () => {
    let n = 0
    const deps = { execSql: () => { if (++n === 2) throw new Error('db busy') }, playwright: ids => ({ results: [{ id: ids[0], status: 'pass' }] }) }
    const out = await runCheck([{ label: 'x', code: 's("bd")' }], { deps })
    assert.equal(out.results[0].status, 'pass')
  })

  test('an id checks a library pattern in place: no temp rows at all', async () => {
    const deps = fakeDeps(ids => ({ results: ids.map(id => ({ id, status: 'pass' })) }))
    const out = await runCheck([{ label: 'birds', id: 'birds-of-a-feather' }], { deps })
    assert.deepEqual(deps.calls.map(c => c[0]), ['playwright'])
    assert.deepEqual(deps.calls[0][1], ['birds-of-a-feather'])
    assert.equal(out.results[0].status, 'pass')
  })

  test('maps errors, missing sounds and dependencies back to the caller\'s labels', async () => {
    const deps = fakeDeps(ids => ({
      results: [
        { id: ids[0], status: 'pass' },
        { id: ids[1], status: 'missing-sounds', missingSounds: ['amen'] },
        { id: ids[2], status: 'error', error: 'x.foo is not a function' },
        { id: ids[3], status: 'error', error: 'unexpected token' },
      ],
    }))
    const out = await runCheck(['a', 'b', 'c', 'd'].map(label => ({ label, code: 's("bd")' })), { deps })
    assert.deepEqual(out.results.map(r => r.status), ['pass', 'missing-sounds', 'dependency', 'error'])
    assert.deepEqual(out.results[1].missingSounds, ['amen'])
    assert.deepEqual(out.results[2].depends, ['foo'])
  })

  test('a pattern the run did not report is an error, never a silent pass', async () => {
    const deps = fakeDeps({ results: [] })
    const out = await runCheck([{ label: 'ghost', code: 's("bd")' }], { deps })
    assert.equal(out.results[0].status, 'error')
    assert.match(out.results[0].error, /did not report/)
  })
})

describe('runCheck (fast tier)', () => {
  const triage = { check: async code => code.includes('amen') ? { status: 'missing-sounds', missing: ['amen'] } : code.includes('boom') ? { status: 'error', error: 'boom is not defined' } : code === 'silence' ? { status: 'inconclusive', notes: ['no events'] } : { status: 'pass' } }
  const deps = { createTriage: async () => triage }

  test('runs Node triage only — no database, no browser', async () => {
    const out = await runCheck([
      { label: 'ok', code: 's("bd")' },
      { label: 'silent', code: 's("amen")' },
      { label: 'dep', code: 'boom()' },
      { label: 'empty', code: 'silence' },
    ], { tier: 'fast', deps })
    assert.equal(out.tier, 'fast')
    assert.deepEqual(out.results.map(r => r.status), ['pass', 'missing-sounds', 'dependency', 'inconclusive'])
    assert.deepEqual(out.results[1].missingSounds, ['amen'])
  })

  test('an unknown library id is an error', async () => {
    const out = await runCheck([{ label: 'nope', id: 'no-such-pattern' }], { tier: 'fast', deps })
    assert.equal(out.results[0].status, 'error')
  })
})
