import assert from 'node:assert/strict'
import { test } from 'node:test'
import { score } from './score.mjs'

const NO_INDEX = { available: false, reason: 'no index yet' }
const PASS = { verdict: 'pass', events: 8 }
const INCONCLUSIVE = { verdict: 'inconclusive', events: 0 }
const FAIL_ERROR = { verdict: 'fail', error: 'lpd is not a function' }
const FAIL_MISSING = { verdict: 'fail', missing: ['amen'] }
const NO_CODE = { verdict: 'no-code' }

const docsCase = { id: 'd', kind: 'docs', message: 'what does .fast do?', expect: ['fast'] }
const docsCodeRequired = { id: 'd2', kind: 'docs', message: 'show me .fast', expect: ['fast'], code: 'required' }
const fixCase = { id: 'f', kind: 'fix', broken: 's("bd").lpd(1)', error: 'lpd is not a function', keep: ['s("bd")'] }
const composeCase = { id: 'c', kind: 'compose', message: 'a beat', mustUse: ['bd'], mustNotUse: ['jungle'], minEvents: 4 }

test('every function-existence check is reported unavailable while there is no index, for every kind', () => {
  const reply = 'The `.fast` function speeds up a pattern.\n```strudel\ns("bd").fast(2)\n```'
  for (const [c, outcome] of [[docsCase, PASS], [fixCase, PASS], [composeCase, PASS]]) {
    const { checks, verdict } = score(c, reply, outcome, NO_INDEX)
    assert.deepEqual(checks.functionExistence, { result: 'unavailable', reason: 'no index yet' })
    // it never turns an otherwise-passing case into a fail
    assert.notEqual(verdict, 'fail')
  }
})

test('docs: every expected function present passes', () => {
  const reply = 'The `.fast` function speeds up a pattern.\n```strudel\ns("bd").fast(2)\n```'
  const { verdict } = score(docsCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'pass')
})

test('docs: a missing expected function fails and names it', () => {
  const reply = 'I have no idea what you mean.'
  const { checks, verdict } = score(docsCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.expect, { result: 'fail', missing: ['fast'] })
})

test('docs: a forbidden function mentioned fails', () => {
  const c = { ...docsCase, forbid: ['slow'] }
  const reply = 'Use `.fast` or `.slow` to change speed.\n```strudel\ns("bd").fast(2)\n```'
  const { checks, verdict } = score(c, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.forbid, { result: 'fail', found: ['slow'] })
})

test('docs: code required and none given fails', () => {
  const reply = '`.fast` speeds a pattern up, no example needed.'
  const { checks, verdict } = score(docsCodeRequired, reply, NO_CODE, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.equal(checks.code.result, 'fail')
})

test('docs: code optional (default) is not required even if code fails evaluation', () => {
  const reply = 'The `.fast` function speeds up a pattern.\n```strudel\ns("bd"\n```'
  const { verdict } = score(docsCase, reply, FAIL_ERROR, NO_INDEX)
  assert.equal(verdict, 'pass')
})

test('fix: passes when the code evaluates, changed, and kept the fragment', () => {
  const reply = 'Use `.lpf` instead:\n```strudel\ns("bd").lpf(800)\n```'
  const { verdict } = score(fixCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'pass')
})

test('fix: returning the broken code unchanged fails, even though it contains code', () => {
  const reply = '```strudel\ns("bd").lpd(1)\n```'
  const { checks, verdict } = score(fixCase, reply, FAIL_ERROR, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.equal(checks.changed.result, 'fail')
})

test('fix: dropping a kept fragment fails and names it', () => {
  const reply = '```strudel\nnote("c e g").lpf(800)\n```'
  const { checks, verdict } = score(fixCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.keep, { result: 'fail', missing: ['s("bd")'] })
})

test('fix: an evaluation error fails with the error recorded', () => {
  const reply = '```strudel\ns("bd").lpx(1)\n```'
  const { checks, verdict } = score(fixCase, reply, FAIL_ERROR, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.equal(checks.evaluates.detail.error, 'lpd is not a function')
})

test('fix: a sound the app does not load fails naming the sound', () => {
  const reply = '```strudel\ns("amen").lpf(800)\n```'
  const { checks, verdict } = score(fixCase, reply, FAIL_MISSING, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.evaluates.detail.missing, ['amen'])
})

test('code producing no events is inconclusive, not a pass, and is visible in the checks', () => {
  const reply = '```strudel\ns("bd").lpf(800)\n```'
  const { checks, verdict } = score(fixCase, reply, INCONCLUSIVE, NO_INDEX)
  assert.equal(verdict, 'inconclusive')
  assert.equal(checks.evaluates.result, 'inconclusive')
})

test('compose: passes when every constraint holds', () => {
  const reply = '```strudel\ns("bd*4, hh*8")\n```'
  const { verdict } = score(composeCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'pass')
})

test('docs: an alternatives group ([\'note\', \'chord\']) passes if either name is mentioned', () => {
  const c = { ...docsCase, expect: [['note', 'chord']] }
  assert.equal(score(c, 'use `note("c e g")`', PASS, NO_INDEX).verdict, 'pass')
  assert.equal(score(c, 'use `chord("Cmaj")`', PASS, NO_INDEX).verdict, 'pass')
})

test('docs: an alternatives group fails, naming the whole group, when neither is mentioned', () => {
  const c = { ...docsCase, expect: [['note', 'chord']] }
  const { checks, verdict } = score(c, 'no idea', PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.expect, { result: 'fail', missing: ['note or chord'] })
})

test('compose: a mustUse alternatives group ([\'lpf\', \'cutoff\']) passes if either is used', () => {
  const c = { ...composeCase, mustUse: [['lpf', 'cutoff']] }
  assert.equal(score(c, '```strudel\ns("bd").lpf(800)\n```', PASS, NO_INDEX).verdict, 'pass')
  assert.equal(score(c, '```strudel\ns("bd").cutoff(800)\n```', PASS, NO_INDEX).verdict, 'pass')
})

test('compose: a missing required name fails and names it', () => {
  const reply = '```strudel\ns("hh*8")\n```'
  const { checks, verdict } = score(composeCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.mustUse, { result: 'fail', missing: ['bd'] })
})

test('compose: a forbidden name present fails', () => {
  const reply = '```strudel\ns("bd*4, jungle")\n```'
  const { checks, verdict } = score(composeCase, reply, PASS, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.mustNotUse, { result: 'fail', found: ['jungle'] })
})

test('compose: too few events fails', () => {
  const reply = '```strudel\ns("bd")\n```'
  const { checks, verdict } = score(composeCase, reply, { ...PASS, events: 1 }, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.deepEqual(checks.minEvents, { result: 'fail', got: 1, wanted: 4 })
})

test('a reply with no code where code is required fails, for compose too', () => {
  const reply = 'Sure, imagine a beat.'
  const { checks, verdict } = score(composeCase, reply, NO_CODE, NO_INDEX)
  assert.equal(verdict, 'fail')
  assert.equal(checks.mustUse.result, 'fail')
})

test('scoring the same inputs twice gives identical output', () => {
  const reply = '```strudel\ns("bd*4, hh*8")\n```'
  assert.deepEqual(score(composeCase, reply, PASS, NO_INDEX), score(composeCase, reply, PASS, NO_INDEX))
})

test('every reply also gets the formatting measures', () => {
  const reply = '```strudel\ns("bd")\n```'
  const { formatting } = score(composeCase, reply, PASS, NO_INDEX)
  assert.equal(formatting.strudel, true)
})
