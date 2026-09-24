import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { hashEmbeddedText, planEmbeddingWork, textToEmbed } from './knowledge-search.mjs'

describe('textToEmbed', () => {
  test('short text is embedded unchanged, title-prefixed', () => {
    const { text, truncated } = textToEmbed({ title: 'rev', text: 'Reverses a pattern.' })
    assert.equal(text, 'rev: Reverses a pattern.')
    assert.equal(truncated, false)
  })

  test('long text is truncated, and reported as such', () => {
    const long = 'x'.repeat(3000)
    const { text, truncated } = textToEmbed({ title: 'x', text: long })
    assert.ok(text.length < 3000)
    assert.equal(truncated, true)
  })

  test('an empty description still produces a sensible string from the title alone', () => {
    const { text, truncated } = textToEmbed({ title: 'mystery', text: '' })
    assert.equal(text, 'mystery: ')
    assert.equal(truncated, false)
  })
})

describe('hashEmbeddedText', () => {
  test('the same text hashes the same', () => {
    assert.equal(hashEmbeddedText('a'), hashEmbeddedText('a'))
  })

  test('different text hashes differently', () => {
    assert.notEqual(hashEmbeddedText('a'), hashEmbeddedText('b'))
  })
})

describe('planEmbeddingWork', () => {
  const chunkA = { id: 'a', title: 'a', text: 'text a' }
  const chunkB = { id: 'b', title: 'b', text: 'text b' }

  function hashOf(chunk) {
    return hashEmbeddedText(textToEmbed(chunk).text)
  }

  test('a chunk with no existing hash needs embedding', () => {
    const { toEmbed, toDelete } = planEmbeddingWork([chunkA], new Map())
    assert.deepEqual(toEmbed, [chunkA])
    assert.deepEqual(toDelete, [])
  })

  test('a chunk whose hash already matches is skipped', () => {
    const existing = new Map([['a', hashOf(chunkA)]])
    const { toEmbed } = planEmbeddingWork([chunkA], existing)
    assert.deepEqual(toEmbed, [])
  })

  test('a chunk whose text changed (different hash) needs re-embedding', () => {
    const existing = new Map([['a', 'stale-hash']])
    const { toEmbed } = planEmbeddingWork([chunkA], existing)
    assert.deepEqual(toEmbed, [chunkA])
  })

  test('a chunk id no longer in the corpus is planned for deletion', () => {
    const existing = new Map([['a', hashOf(chunkA)], ['gone', 'whatever']])
    const { toEmbed, toDelete } = planEmbeddingWork([chunkA], existing)
    assert.deepEqual(toEmbed, [])
    assert.deepEqual(toDelete, ['gone'])
  })

  test('mixed: one unchanged, one changed, one new, one deleted', () => {
    const existing = new Map([
      ['a', hashOf(chunkA)], // unchanged
      ['b', 'stale'], // changed
      ['gone', 'whatever'], // deleted
    ])
    const chunkC = { id: 'c', title: 'c', text: 'text c' } // new
    const { toEmbed, toDelete } = planEmbeddingWork([chunkA, chunkB, chunkC], existing)
    assert.deepEqual(toEmbed.map(c => c.id).sort(), ['b', 'c'])
    assert.deepEqual(toDelete, ['gone'])
  })
})
