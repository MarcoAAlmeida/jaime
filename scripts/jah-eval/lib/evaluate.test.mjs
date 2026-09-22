import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateReply } from './evaluate.mjs'

function fakeTriage(result) {
  return { check: async () => result }
}

test('no code in the reply is reported as no-code, without calling the evaluator', async () => {
  let called = false
  const triage = { check: async () => { called = true; return { status: 'pass' } } }
  const outcome = await evaluateReply(triage, 'just words, no fence')
  assert.deepEqual(outcome, { verdict: 'no-code' })
  assert.equal(called, false)
})

test('a passing evaluation carries the event count', async () => {
  const triage = fakeTriage({ status: 'pass', events: 8 })
  const outcome = await evaluateReply(triage, '```strudel\ns("bd sd")\n```')
  assert.deepEqual(outcome, { verdict: 'pass', events: 8 })
})

test('an inconclusive evaluation is not a pass', async () => {
  const triage = fakeTriage({ status: 'inconclusive', events: 0 })
  const outcome = await evaluateReply(triage, '```strudel\nsilence\n```')
  assert.deepEqual(outcome, { verdict: 'inconclusive', events: 0 })
})

test('missing sounds fail with the sound names', async () => {
  const triage = fakeTriage({ status: 'missing-sounds', missing: ['amen'] })
  const outcome = await evaluateReply(triage, '```strudel\ns("amen")\n```')
  assert.deepEqual(outcome, { verdict: 'fail', missing: ['amen'] })
})

test('an evaluation error fails with the error message', async () => {
  const triage = fakeTriage({ status: 'error', error: 'lpd is not a function' })
  const outcome = await evaluateReply(triage, '```strudel\ns("bd").lpd(1)\n```')
  assert.deepEqual(outcome, { verdict: 'fail', error: 'lpd is not a function' })
})
