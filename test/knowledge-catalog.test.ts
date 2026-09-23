import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { findChunkByName } from '../server/catalog/knowledge'

const db = env.PATTERNS_DB

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
