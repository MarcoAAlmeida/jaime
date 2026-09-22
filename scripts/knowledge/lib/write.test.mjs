import assert from 'node:assert/strict'
import { test } from 'node:test'
import { serializeCorpus, writeCorpus } from './write.mjs'

function report(overrides = {}) {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    submoduleCommit: '8f81463',
    strudelVersions: { core: '1.2.6' },
    chunks: [
      { id: 'zed', kind: 'function', title: 'zed', tags: [], text: 't', synonyms: [], params: [], examples: [] },
      { id: 'abc', kind: 'concept', title: 'abc', tags: [], text: 't' },
      { id: 'abc', kind: 'example', title: 'abc example', tags: [], text: 't' },
    ],
    gaps: [],
    validation: [],
    ...overrides,
  }
}

test('serializeCorpus() sorts chunks by (kind, id)', () => {
  const parsed = JSON.parse(serializeCorpus(report()))
  assert.deepEqual(parsed.chunks.map(c => `${c.kind}:${c.id}`), ['concept:abc', 'example:abc', 'function:zed'])
})

test('serializeCorpus() orders each chunk\'s own keys, keeping only the ones it has', () => {
  const parsed = JSON.parse(serializeCorpus(report()))
  const concept = parsed.chunks.find(c => c.kind === 'concept')
  assert.deepEqual(Object.keys(concept), ['id', 'kind', 'title', 'tags', 'text'])
  const fn = parsed.chunks.find(c => c.kind === 'function')
  assert.deepEqual(Object.keys(fn), ['id', 'kind', 'title', 'tags', 'text', 'synonyms', 'params', 'examples'])
})

test('serializeCorpus() orders the top-level report keys and ends with a trailing newline', () => {
  const text = serializeCorpus(report())
  assert.ok(text.endsWith('\n'))
  assert.deepEqual(Object.keys(JSON.parse(text)), ['generatedAt', 'submoduleCommit', 'strudelVersions', 'chunks', 'gaps', 'validation'])
})

test('serializeCorpus() is byte-identical across two calls with the same input', () => {
  assert.equal(serializeCorpus(report()), serializeCorpus(report()))
})

test('serializeCorpus() is insensitive to the input chunks\' order', () => {
  const r = report()
  const reversed = { ...r, chunks: [...r.chunks].reverse() }
  assert.equal(serializeCorpus(r), serializeCorpus(reversed))
})

test('writeCorpus() serializes a raw report and writes the result', () => {
  let written = null
  writeCorpus('/fake/path.json', report(), { writeFile: (path, text) => { written = { path, text } } })
  assert.equal(written.path, '/fake/path.json')
  assert.equal(written.text, serializeCorpus(report()))
})

test('writeCorpus() writes pre-serialized text as-is, without re-serializing', () => {
  let written = null
  writeCorpus('/fake/path.json', 'already text', { writeFile: (path, text) => { written = { path, text } } })
  assert.deepEqual(written, { path: '/fake/path.json', text: 'already text' })
})
