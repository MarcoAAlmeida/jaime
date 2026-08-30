import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { getPattern, listPatterns, listTags } from '../server/catalog/patterns'

const db = env.PATTERNS_DB
const SEED_COUNT = 20

describe('listPatterns', () => {
  it('paginates and covers every seeded pattern exactly once', async () => {
    const seen = new Set<string>()
    let page = 1
    let total = -1

    for (;;) {
      const res = await listPatterns(db, { page, limit: 7 })
      total = res.total
      expect(res.pageSize).toBe(7)
      expect(res.page).toBe(page)
      for (const p of res.patterns) {
        expect(seen.has(p.id)).toBe(false)
        seen.add(p.id)
      }
      if (page * res.pageSize >= res.total) break
      page += 1
    }

    expect(total).toBe(SEED_COUNT)
    expect(seen.size).toBe(SEED_COUNT)
  })

  it('orders by createdAt desc, id — stable across pages', async () => {
    const p1 = await listPatterns(db, { page: 1, limit: 5 })
    const p2 = await listPatterns(db, { page: 2, limit: 5 })
    const combined = [...p1.patterns, ...p2.patterns].map(p => p.createdAt)
    const sorted = [...combined].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    expect(combined).toEqual(sorted)
  })

  it('caps the page size at 60 and defaults to 24', async () => {
    expect((await listPatterns(db, { limit: 500 })).pageSize).toBe(60)
    expect((await listPatterns(db, {})).pageSize).toBe(24)
  })

  it('narrows to patterns carrying a tag, with a matching total', async () => {
    const res = await listPatterns(db, { tags: ['drums'], limit: 60 })
    expect(res.patterns.length).toBeGreaterThan(0)
    expect(res.patterns.length).toBeLessThan(SEED_COUNT)
    expect(res.total).toBe(res.patterns.length)
    for (const p of res.patterns) expect(p.tags).toContain('drums')
  })

  it('requires every listed tag (AND) when more than one is given', async () => {
    const res = await listPatterns(db, { tags: ['drums', 'euclidean'], limit: 60 })
    expect(res.patterns.length).toBeGreaterThan(0)
    for (const p of res.patterns) {
      expect(p.tags).toContain('drums')
      expect(p.tags).toContain('euclidean')
    }
    // Strictly fewer than the single-tag result.
    const drumsOnly = await listPatterns(db, { tags: ['drums'], limit: 60 })
    expect(res.patterns.length).toBeLessThan(drumsOnly.patterns.length)
  })

  it('returns a valid empty page for a tag nothing carries', async () => {
    const res = await listPatterns(db, { tags: ['no-such-tag'] })
    expect(res.patterns).toEqual([])
    expect(res.total).toBe(0)
    expect(res.page).toBe(1)
  })

  it('text search matches title and tag, excludes non-matches', async () => {
    const byTitle = await listPatterns(db, { q: 'acid', limit: 60 })
    expect(byTitle.patterns.some(p => p.id === 'seed-acid-line')).toBe(true)
    expect(byTitle.patterns.every(p => p.id !== 'seed-four-on-the-floor')).toBe(true)

    const byTag = await listPatterns(db, { q: 'ambient', limit: 60 })
    expect(byTag.patterns.some(p => p.tags.includes('ambient'))).toBe(true)
    expect(byTag.patterns.every(p => p.tags.includes('ambient') || /ambient/i.test(p.title))).toBe(true)
  })

  it('combines text query and tag filter', async () => {
    const res = await listPatterns(db, { tags: ['chords'], q: 'pad', limit: 60 })
    for (const p of res.patterns) {
      expect(p.tags).toContain('chords')
      expect(/pad/i.test(p.title) || p.tags.some(t => /pad/i.test(t))).toBe(true)
    }
    expect(res.patterns.some(p => p.id === 'seed-sine-pad')).toBe(true)
  })

  it('assembles the full pattern shape', async () => {
    const { patterns } = await listPatterns(db, { tags: ['acid'] })
    const p = patterns[0]!
    expect(p).toMatchObject({
      id: 'seed-acid-line',
      title: 'Acid line',
      source: { url: expect.stringContaining('http'), author: null },
    })
    expect(typeof p.code).toBe('string')
    expect(Array.isArray(p.tags)).toBe(true)
    expect(p.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('getPattern', () => {
  it('returns a pattern with its tags and source', async () => {
    const p = await getPattern(db, 'seed-sine-pad')
    expect(p?.title).toBe('Sine pad')
    expect(p?.tags).toEqual([...p!.tags].sort())
    expect(p?.tags).toContain('pad')
    expect(p?.source.url).toContain('strudel.cc')
  })

  it('returns null for an unknown id', async () => {
    expect(await getPattern(db, 'nope')).toBeNull()
  })
})

describe('listTags', () => {
  it('returns the distinct tags, sorted', async () => {
    const tags = await listTags(db)
    expect(tags).toEqual([...new Set(tags)])
    expect(tags).toEqual([...tags].sort())
    expect(tags).toContain('drums')
    expect(tags).toContain('ambient')
  })
})
