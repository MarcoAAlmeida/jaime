import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assembleCorpus, buildConceptAndExampleChunks, buildFunctionChunks } from './chunks.mjs'

const COMMIT = { commit: '8f81463' }

function doclet(overrides = {}) {
  return {
    name: 'rev', longname: 'Pattern.rev', memberof: 'Pattern',
    description: 'Reverses a pattern.', synonyms: ['reverse'], tags: ['structure'],
    params: [], examples: ['note("c d e").rev()'], sourcePath: 'packages/core/pattern.mjs',
    ...overrides,
  }
}

test('a nameless (anonymous) doclet is skipped and reported, never turned into a chunk with no id', () => {
  // A real jsdoc artifact found in the corpus (2026-09-22): a doclet with
  // no @name at all.
  const nameless = doclet({ name: undefined, longname: undefined, memberof: null, description: '', tags: [], synonyms: [], sourcePath: null })
  const { chunks, gaps } = buildFunctionChunks([doclet(), nameless], new Map([['rev', 'Time Modifiers']]), COMMIT)
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].id, 'rev')
  assert.equal(gaps.length, 1)
  assert.match(gaps[0], /anonymous doclet.*no @name/)
})

test('a categorized function gets the shared schema and no gap', () => {
  const categoryByFunction = new Map([['rev', 'Time Modifiers']])
  const { chunks, gaps, collisions } = buildFunctionChunks([doclet()], categoryByFunction, COMMIT)
  assert.deepEqual(gaps, [])
  assert.deepEqual(collisions, [])
  assert.deepEqual(chunks, [{
    id: 'rev', kind: 'function', title: 'rev', category: 'Time Modifiers', tags: ['structure'],
    text: 'Reverses a pattern.',
    sourceUrl: 'https://codeberg.org/uzu/strudel/src/commit/8f81463/packages/core/pattern.mjs',
    license: 'AGPL-3.0', version: '8f81463',
    synonyms: ['reverse'], params: [], examples: ['note("c d e").rev()'],
  }])
})

test('a function on no page falls back to a category derived from its source, and is reported as a gap', () => {
  const { chunks, gaps } = buildFunctionChunks([doclet()], new Map(), COMMIT)
  assert.equal(chunks[0].category, 'pattern')
  assert.equal(gaps.length, 1)
  assert.match(gaps[0], /rev.*not presented on any documentation page/)
})

test('a function with no memberof and no source falls back to "uncategorized"', () => {
  const { chunks } = buildFunctionChunks([doclet({ memberof: null, sourcePath: null })], new Map(), COMMIT)
  assert.equal(chunks[0].category, 'uncategorized')
})

test('two doclets sharing a name are a reported collision, the first wins', () => {
  const { chunks, collisions } = buildFunctionChunks([doclet(), doclet({ description: 'a different one' })], new Map(), COMMIT)
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].text, 'Reverses a pattern.')
  assert.equal(collisions.length, 1)
  assert.match(collisions[0], /duplicate function id "rev"/)
})

test('a concept and its example get the shared schema and matching ids', () => {
  const pages = [{
    path: 'learn/mini-notation.mdx',
    parsed: {
      concepts: [{ heading: 'Sequences', category: 'Mini Notation', text: 'A sequence plays one step per cycle.' }],
      examples: [{ heading: 'Sequences', category: 'Mini Notation', code: 's("bd sd")', index: 0 }],
    },
  }]
  const { chunks, collisions } = buildConceptAndExampleChunks(pages, COMMIT)
  assert.deepEqual(collisions, [])
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].id, 'learn-mini-notation-sequences')
  assert.equal(chunks[0].kind, 'concept')
  assert.equal(chunks[1].id, 'learn-mini-notation-sequences-example-0')
  assert.equal(chunks[1].kind, 'example')
  assert.equal(chunks[1].text, 's("bd sd")')
  assert.match(chunks[0].sourceUrl, /learn\/mini-notation\.mdx$/)
})

test('two pages producing the same concept id is a reported collision', () => {
  const section = { concepts: [{ heading: 'Intro', category: 'X', text: 'a' }], examples: [] }
  const pages = [
    { path: 'learn/a.mdx', parsed: section },
    { path: 'learn/a.mdx', parsed: section }, // same page path twice, forcing the same id on purpose
  ]
  const { chunks, collisions } = buildConceptAndExampleChunks(pages, COMMIT)
  assert.equal(chunks.length, 1)
  assert.equal(collisions.length, 1)
})

test('assembleCorpus() combines both pools and still catches a cross-kind collision', () => {
  const functionResult = { chunks: [{ id: 'x', kind: 'function' }], gaps: ['g1'], collisions: ['c1'] }
  const conceptResult = { chunks: [{ id: 'x', kind: 'concept' }, { id: 'y', kind: 'concept' }], collisions: [] }
  const { chunks, gaps, collisions } = assembleCorpus(functionResult, conceptResult)
  assert.deepEqual(chunks.map(c => c.id), ['x', 'y'])
  assert.equal(chunks[0].kind, 'function') // the function pool's "x" won
  assert.deepEqual(gaps, ['g1'])
  assert.deepEqual(collisions, ['c1', 'duplicate id "x" across chunk kinds — kept the first, dropped this one'])
})
