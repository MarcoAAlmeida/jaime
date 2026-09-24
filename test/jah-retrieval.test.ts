import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { KnowledgeChunk } from '../server/catalog/knowledge'
import { findChunkByName } from '../server/catalog/knowledge'
import { chunkToContextBlock, extractCandidateNames, retrieveContext } from '../server/jah/retrieval'

function chunk(overrides: Partial<KnowledgeChunk> = {}): KnowledgeChunk {
  return {
    id: 'rev', kind: 'function', title: 'rev', category: 'Time Modifiers',
    tags: ['temporal'], text: 'Reverses a pattern.', sourceUrl: 'https://example.com/rev',
    license: 'AGPL-3.0', version: '8f81463', synonyms: [], params: [], examples: [],
    ...overrides,
  }
}

describe('extractCandidateNames', () => {
  it('finds a backtick-quoted name', () => {
    expect(extractCandidateNames('what does `lpf` do?')).toEqual(['lpf'])
  })

  it('finds a dot-prefixed name', () => {
    expect(extractCandidateNames('how does .rev work?')).toEqual(['rev'])
  })

  it('finds both, deduplicated and lowercased', () => {
    expect(extractCandidateNames('is `LPF` the same as .lpf?').sort()).toEqual(['lpf'])
  })

  it('finds nothing in a plain-language question with no backticks or dot', () => {
    expect(extractCandidateNames('how do I make a bassline?')).toEqual([])
  })

  it('does not match an ordinary word just because it could be a short function name', () => {
    // "n" and "s" are real, short function names — a broader heuristic
    // than backtick/dot-prefixed would false-hit on ordinary prose.
    expect(extractCandidateNames('is this a good pattern?')).toEqual([])
  })
})

describe('chunkToContextBlock', () => {
  it('a function chunk includes its params and examples', () => {
    const block = chunkToContextBlock(chunk({
      params: [{ name: 'frequency', types: ['number', 'Pattern'], description: 'audible between 0 and 20000' }],
      examples: ['s("bd").lpf(800)'],
    }))
    expect(block).toContain('rev (Time Modifiers)')
    expect(block).toContain('Reverses a pattern.')
    expect(block).toContain('frequency')
    expect(block).toContain('audible between 0 and 20000')
    expect(block).toContain('s("bd").lpf(800)')
  })

  it('a concept chunk (no params/examples) is just title/category/text', () => {
    const block = chunkToContextBlock(chunk({ kind: 'concept', params: [], examples: [] }))
    expect(block).toBe('rev (Time Modifiers)\n\nReverses a pattern.')
  })
})

describe('retrieveContext', () => {
  const rev = chunk({ id: 'rev', title: 'rev' })
  const lpf = chunk({ id: 'lpf', title: 'lpf' })
  const concept = chunk({ id: 'concept-1', title: 'Concept', kind: 'concept' })

  function deps(overrides: { findChunkByName?: (name: string) => Promise<KnowledgeChunk | null>, searchChunks?: (q: string, k: number) => Promise<KnowledgeChunk[]> } = {}) {
    return {
      findChunkByName: overrides.findChunkByName ?? (async () => null),
      searchChunks: overrides.searchChunks ?? (async () => []),
    }
  }

  it('exact-only: a candidate resolves and semantic search finds nothing more', async () => {
    const result = await retrieveContext(deps({ findChunkByName: async name => (name === 'rev' ? rev : null) }), 'what does `rev` do?')
    expect(result.sources.map(s => s.id)).toEqual(['rev'])
    expect(result.contextBlocks).toHaveLength(1)
  })

  it('semantic-only: no explicit candidate, but semantic search finds something', async () => {
    const result = await retrieveContext(deps({ searchChunks: async () => [concept] }), 'something that changes over time')
    expect(result.sources.map(s => s.id)).toEqual(['concept-1'])
  })

  it('both, with overlap: the same chunk from both is included only once', async () => {
    const result = await retrieveContext(deps({
      findChunkByName: async () => rev,
      searchChunks: async () => [rev, lpf],
    }), 'what does `rev` do?')
    expect(result.sources.map(s => s.id)).toEqual(['rev', 'lpf'])
  })

  it('over the cap: bounded, with exact hits kept first', async () => {
    const many = Array.from({ length: 10 }, (_, i) => chunk({ id: `semantic-${i}`, title: `semantic-${i}` }))
    const result = await retrieveContext(deps({
      findChunkByName: async () => rev,
      searchChunks: async () => many,
    }), 'what does `rev` do?')
    expect(result.sources).toHaveLength(5) // MAX_CONTEXT_CHUNKS
    expect(result.sources[0]!.id).toBe('rev')
  })

  it('nothing found: empty context and sources', async () => {
    const result = await retrieveContext(deps(), 'anything at all')
    expect(result.contextBlocks).toEqual([])
    expect(result.sources).toEqual([])
  })
})

describe('retrieveContext against the real seeded local D1 (fake semantic search only)', () => {
  const db = env.PATTERNS_DB

  it('an explicit real name resolves for real via findChunkByName', async () => {
    const result = await retrieveContext(
      { findChunkByName: name => findChunkByName(db, name), searchChunks: async () => [] },
      'what does `lpf` do?',
    )
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]!.id).toBe('lpf')
    expect(result.contextBlocks[0]).toContain('Audio effects')
  })

  it('a fake semantic match resolves to real chunk content via the real findChunkByName', async () => {
    const result = await retrieveContext(
      {
        findChunkByName: () => Promise.resolve(null),
        searchChunks: async () => {
          const revChunk = await findChunkByName(db, 'rev')
          return revChunk ? [revChunk] : []
        },
      },
      'something about reversing',
    )
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0]!.id).toBe('rev')
    expect(result.contextBlocks[0]).toContain('Reverse')
  })
})
