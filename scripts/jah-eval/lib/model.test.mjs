import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runSamples } from './model.mjs'

const docsCase = { id: 'd', kind: 'docs', message: 'what does .fast do?', expect: ['fast'] }
const fixCase = { id: 'f', kind: 'fix', broken: 's("bd").lpd(1)', error: 'lpd is not a function' }

test('every case is sampled the requested number of times', async () => {
  const call = async message => `reply to: ${message}`
  const results = await runSamples([docsCase, fixCase], { samples: 3, call })
  assert.equal(results.length, 6)
  assert.equal(results.filter(r => r.caseId === 'd').length, 3)
  assert.equal(results.filter(r => r.caseId === 'f').length, 3)
  assert.equal(results[0].reply, 'reply to: what does .fast do?')
})

test('a failed call becomes an errored sample and the run continues', async () => {
  let calls = 0
  const call = async () => {
    calls++
    if (calls === 2) throw new Error('boom')
    return 'ok'
  }
  const results = await runSamples([docsCase], { samples: 3, call, concurrency: 1 })
  assert.equal(results.length, 3)
  assert.equal(results.filter(r => r.error).length, 1)
  assert.equal(results.find(r => r.error).error, 'boom')
  assert.equal(results.filter(r => r.reply === 'ok').length, 2)
})

test('sample indices are per case, starting at 0', async () => {
  const call = async () => 'ok'
  const results = await runSamples([docsCase], { samples: 2, call })
  assert.deepEqual(results.map(r => r.sampleIndex).sort(), [0, 1])
})

test('respects a low concurrency without dropping or duplicating jobs', async () => {
  const call = async () => 'ok'
  const results = await runSamples([docsCase, fixCase], { samples: 5, call, concurrency: 1 })
  assert.equal(results.length, 10)
  assert.equal(results.every(r => r.reply === 'ok'), true)
})

test('a fix case\'s message includes its error, via renderMessage', async () => {
  let seen = null
  const call = async (message) => { seen = message; return 'ok' }
  await runSamples([fixCase], { samples: 1, call })
  assert.match(seen, /lpd is not a function/)
})
