import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { formatUndocumentedGaps, loadUndocumentedGaps } from './gaps.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(HERE, '..', '__fixtures__', 'undocumented.json')

test('formatUndocumentedGaps() names every export in every file', () => {
  const gaps = formatUndocumentedGaps({ 'a.mjs': ['x', 'y'], 'b.mjs': ['z'] })
  assert.deepEqual(gaps, [
    'a.mjs: x (undocumented — no JSDoc at all)',
    'a.mjs: y (undocumented — no JSDoc at all)',
    'b.mjs: z (undocumented — no JSDoc at all)',
  ])
})

test('formatUndocumentedGaps() with nothing undocumented reports nothing', () => {
  assert.deepEqual(formatUndocumentedGaps({}), [])
})

test('loadUndocumentedGaps() reads the fixture undocumented.json', () => {
  const gaps = loadUndocumentedGaps(FIXTURE)
  assert.ok(gaps.includes('/packages/core/sample-source.mjs: mystery (undocumented — no JSDoc at all)'))
  assert.equal(gaps.length, 3)
})

test('loadUndocumentedGaps() works with an injected reader too', () => {
  const gaps = loadUndocumentedGaps('anything', { readFile: () => readFileSync(FIXTURE, 'utf8') })
  assert.equal(gaps.length, 3)
})
