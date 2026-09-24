import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { findChunkByName, searchChunks } from '../server/catalog/knowledge'

const db = env.PATTERNS_DB

// searchChunks never touches a real Ai/Vectorize binding in tests (spec:
// "Search Never Runs Against A Real Index In Automated Tests") — these
// fakes stand in, while findChunkByName resolves against the real
// seeded local D1 the same way the tests above do.
function fakeAi(): Ai {
  return { run: async () => ({ data: [[0.1, 0.2, 0.3]] }) } as unknown as Ai
}
function fakeVectorize(matches: Array<{ id: string, score: number }>): VectorizeIndex {
  return { query: (async () => ({ matches, count: matches.length })) as VectorizeIndex['query'] } as VectorizeIndex
}

describe('findChunkByName', () => {
  it('finds a function chunk by its own id', async () => {
    const chunk = await findChunkByName(db, 'rev')
    expect(chunk).not.toBeNull()
    expect(chunk!.kind).toBe('function')
    expect(chunk!.title).toBe('rev')
    expect(chunk!.examples.length).toBeGreaterThan(0)
  })

  it('finds a function chunk by any of its synonyms', async () => {
    // "ctf" is one of lpf's declared synonyms and, unlike "cutoff" (see
    // the next test), isn't itself the id of some unrelated chunk.
    const bySynonym = await findChunkByName(db, 'ctf')
    const byId = await findChunkByName(db, 'lpf')
    expect(bySynonym).not.toBeNull()
    expect(bySynonym!.id).toBe('lpf')
    expect(bySynonym).toEqual(byId)
  })

  it('a name that is both someone else\'s synonym AND its own real chunk id resolves to its own chunk', async () => {
    // "cutoff" is lpf's synonym, but the corpus also documents a
    // distinct, real function literally named "cutoff" (packages/
    // supradough/dough.mjs — the same low-level module that duplicates
    // several pattern-level control names, per design.md's "Verified
    // against the real submodule" notes). Its own true identity wins
    // over being referenced as someone else's alias.
    const chunk = await findChunkByName(db, 'cutoff')
    expect(chunk).not.toBeNull()
    expect(chunk!.id).toBe('cutoff')
  })

  it('a function chunk carries its params', async () => {
    const chunk = await findChunkByName(db, 'lpf')
    expect(chunk!.params.length).toBeGreaterThan(0)
    expect(chunk!.params[0]!.name).toBe('frequency')
    expect(Array.isArray(chunk!.params[0]!.types)).toBe(true)
  })

  it('a concept chunk has empty synonyms/params/examples, not missing fields', async () => {
    const anyConcept = await db.prepare('SELECT id FROM knowledge_chunks WHERE kind = ? LIMIT 1').bind('concept').first<{ id: string }>()
    expect(anyConcept).not.toBeNull()
    const chunk = await findChunkByName(db, anyConcept!.id)
    expect(chunk).not.toBeNull()
    expect(chunk!.synonyms).toEqual([])
    expect(chunk!.params).toEqual([])
    expect(chunk!.examples).toEqual([])
  })

  it('returns null for a name that matches no chunk and no synonym', async () => {
    expect(await findChunkByName(db, 'definitely-not-a-real-function-name')).toBeNull()
  })

  it('one chunk\'s synonym does not resolve to an unrelated chunk', async () => {
    // "ctf" is lpf's synonym, not hpf's or anything else's.
    const chunk = await findChunkByName(db, 'ctf')
    expect(chunk!.id).toBe('lpf')
    expect(chunk!.id).not.toBe('hpf')
  })
})

describe('searchChunks', () => {
  it('returns chunks in the index\'s ranked order, with full content', async () => {
    const vectorize = fakeVectorize([{ id: 'rev', score: 0.9 }, { id: 'lpf', score: 0.8 }])
    const results = await searchChunks(fakeAi(), vectorize, db, 'reverse a pattern')
    expect(results.map(c => c.id)).toEqual(['rev', 'lpf'])
    expect(results[0]!.examples.length).toBeGreaterThan(0)
  })

  it('an empty match list returns [], not an error', async () => {
    const results = await searchChunks(fakeAi(), fakeVectorize([]), db, 'nothing relevant')
    expect(results).toEqual([])
  })

  it('a matched id that no longer resolves to a chunk is silently dropped, not an error', async () => {
    const vectorize = fakeVectorize([{ id: 'rev', score: 0.9 }, { id: 'stale-deleted-id', score: 0.85 }])
    const results = await searchChunks(fakeAi(), vectorize, db, 'reverse a pattern')
    expect(results.map(c => c.id)).toEqual(['rev'])
  })

  it('honors a custom topK', async () => {
    let seenOptions: { topK?: number } = {}
    const vectorize = {
      query: (async (_vector: number[], options: { topK?: number }) => {
        seenOptions = options
        return { matches: [{ id: 'rev', score: 0.9 }], count: 1 }
      }) as VectorizeIndex['query'],
    } as VectorizeIndex
    await searchChunks(fakeAi(), vectorize, db, 'anything', 3)
    expect(seenOptions.topK).toBe(3)
  })
})
