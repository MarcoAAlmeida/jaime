import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkAgainstStrudelSnapshot,
  checkPlayability,
  parseStrudelSnapshot,
  STRUDEL_SKIPPED_EXAMPLES,
  validateCorpus,
} from './validate.mjs'

const FUNCTION_CHUNK = { id: 'rev', kind: 'function', title: 'rev', examples: ['note("c d e").rev()', '"a b".rev()'] }
const EXAMPLE_CHUNK = { id: 'learn-x-example-0', kind: 'example', title: 'x example', text: 's("bd sd")' }
const CONCEPT_CHUNK = { id: 'learn-x', kind: 'concept', title: 'x', text: 'some prose' }

function fakeTriage(byCode) {
  return { check: async code => byCode[code] ?? { status: 'pass' } }
}

test('checkPlayability() reports nothing for a chunk whose examples all pass', async () => {
  const entries = await checkPlayability(FUNCTION_CHUNK, fakeTriage({}))
  assert.deepEqual(entries, [])
})

test('checkPlayability() reports an error, naming the example', async () => {
  const triage = fakeTriage({ '"a b".rev()': { status: 'error', error: 'boom' } })
  const entries = await checkPlayability(FUNCTION_CHUNK, triage)
  assert.deepEqual(entries, [{ chunkId: 'rev', exampleIndex: 1, issue: 'error', detail: 'boom' }])
})

test('checkPlayability() reports missing sounds with their names', async () => {
  const triage = fakeTriage({ 'note("c d e").rev()': { status: 'missing-sounds', missing: ['amen'] } })
  const entries = await checkPlayability(FUNCTION_CHUNK, triage)
  assert.deepEqual(entries[0], { chunkId: 'rev', exampleIndex: 0, issue: 'missing-sounds', detail: 'amen' })
})

test('checkPlayability() reports inconclusive separately, never as a pass', async () => {
  const triage = fakeTriage({ 'note("c d e").rev()': { status: 'inconclusive' } })
  const entries = await checkPlayability(FUNCTION_CHUNK, triage)
  assert.equal(entries[0].issue, 'inconclusive')
})

test('checkPlayability() checks an example chunk\'s own text, and skips a concept chunk entirely', async () => {
  const triage = fakeTriage({ 's("bd sd")': { status: 'error', error: 'boom' } })
  assert.equal((await checkPlayability(EXAMPLE_CHUNK, triage)).length, 1)
  assert.deepEqual(await checkPlayability(CONCEPT_CHUNK, triage), [])
})

test('parseStrudelSnapshot() reads a real-shaped entry, stripping the describe prefix and vitest counter', () => {
  const text = [
    '// Vitest Snapshot v1',
    '',
    'exports[`runs examples > example "rev" example index 0 1`] = `',
    '[',
    '  "[ 0/1 → 1/2 | note:c3 ]",',
    '  "[ 1/2 → 1/1 | note:e3 ]",',
    ']',
    '`;',
    '',
  ].join('\n')
  const map = parseStrudelSnapshot(text)
  assert.deepEqual(map.get('example "rev" example index 0'), ['[ 0/1 → 1/2 | note:c3 ]', '[ 1/2 → 1/1 | note:e3 ]'])
})

test('checkAgainstStrudelSnapshot() matches when the re-evaluated output is identical', async () => {
  const map = new Map([['example "rev" example index 0', ['a', 'b']]])
  const result = await checkAgainstStrudelSnapshot(FUNCTION_CHUNK, 0, map, async () => ['a', 'b'])
  assert.equal(result, null)
})

test('checkAgainstStrudelSnapshot() reports a mismatch with both sides, not silently', async () => {
  const map = new Map([['example "rev" example index 0', ['a', 'b']]])
  const result = await checkAgainstStrudelSnapshot(FUNCTION_CHUNK, 0, map, async () => ['a', 'c'])
  assert.equal(result.issue, 'mismatch')
  assert.deepEqual(result.detail, { expected: ['a', 'b'], actual: ['a', 'c'] })
})

test('checkAgainstStrudelSnapshot() skips a name on Strudel\'s own skip list', async () => {
  const chunk = { ...FUNCTION_CHUNK, title: STRUDEL_SKIPPED_EXAMPLES[0] }
  const result = await checkAgainstStrudelSnapshot(chunk, 0, new Map(), async () => { throw new Error('should not be called') })
  assert.equal(result, null)
})

test('checkAgainstStrudelSnapshot() reports a missing snapshot entry rather than assuming a pass', async () => {
  const result = await checkAgainstStrudelSnapshot(FUNCTION_CHUNK, 0, new Map(), async () => ['a'])
  assert.equal(result.issue, 'no-snapshot-entry')
})

test('checkAgainstStrudelSnapshot() never runs for a non-function chunk', async () => {
  const result = await checkAgainstStrudelSnapshot(EXAMPLE_CHUNK, 0, new Map(), async () => { throw new Error('should not be called') })
  assert.equal(result, null)
})

test('validateCorpus() combines both checks across a whole corpus', async () => {
  const chunks = [
    { ...FUNCTION_CHUNK, examples: ['ok code'] },
    EXAMPLE_CHUNK,
  ]
  const triage = fakeTriage({ 's("bd sd")': { status: 'error', error: 'boom' } })
  const snapshotText = 'exports[`runs examples > example "rev" example index 0 1`] = `\n["x"]\n`;\n'
  const queryFn = async () => ['not-x']

  const entries = await validateCorpus(chunks, { triage, snapshotText, queryFn })
  assert.equal(entries.length, 2)
  assert.ok(entries.some(e => e.chunkId === 'rev' && e.issue === 'mismatch'))
  assert.ok(entries.some(e => e.chunkId === EXAMPLE_CHUNK.id && e.issue === 'error'))
})

test('validateCorpus() without a snapshot/queryFn still runs playability checks', async () => {
  const triage = fakeTriage({ 's("bd sd")': { status: 'error', error: 'boom' } })
  const entries = await validateCorpus([EXAMPLE_CHUNK], { triage })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].issue, 'error')
})
