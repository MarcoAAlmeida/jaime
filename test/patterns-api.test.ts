import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

async function get(path: string) {
  const res = await SELF.fetch(`https://jaime.stream${path}`)
  return { status: res.status, body: await res.json() as any }
}

describe('GET /api/patterns', () => {
  it('returns a paginated first page with the list envelope', async () => {
    const { status, body } = await get('/api/patterns')
    expect(status).toBe(200)
    expect(body).toMatchObject({ page: 1, pageSize: 24 })
    // The curated catalog (content/patterns/*.md) is larger than one page.
    expect(body.total).toBeGreaterThanOrEqual(24)
    expect(body.patterns).toHaveLength(24)
    expect(body.patterns[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      code: expect.any(String),
      tags: expect.any(Array),
      source: { url: expect.any(String) },
      createdAt: expect.any(String),
    })
  })

  it('respects limit and page', async () => {
    const p1 = await get('/api/patterns?limit=6&page=1')
    const p2 = await get('/api/patterns?limit=6&page=2')
    expect(p1.body.patterns).toHaveLength(6)
    expect(p2.body.page).toBe(2)
    const ids = new Set([...p1.body.patterns, ...p2.body.patterns].map((p: any) => p.id))
    expect(ids.size).toBe(12)
  })

  it('filters by a repeated tag param (AND)', async () => {
    const { body } = await get('/api/patterns?tag=drums&tag=euclidean')
    expect(body.patterns.length).toBeGreaterThan(0)
    for (const p of body.patterns) {
      expect(p.tags).toEqual(expect.arrayContaining(['drums', 'euclidean']))
    }
    expect(body.total).toBe(body.patterns.length)
  })

  it('an unmatched tag yields a valid empty page', async () => {
    const { status, body } = await get('/api/patterns?tag=definitely-not-a-tag')
    expect(status).toBe(200)
    expect(body.patterns).toEqual([])
    expect(body.total).toBe(0)
  })

  it('searches by text over title and tags', async () => {
    const { body } = await get('/api/patterns?q=acid')
    expect(body.patterns.some((p: any) => p.id === 'seed-acid-line')).toBe(true)
    expect(body.patterns.every((p: any) => p.id !== 'seed-four-on-the-floor')).toBe(true)
  })

  it('combines q and tag', async () => {
    const { body } = await get('/api/patterns?tag=chords&q=pad')
    expect(body.patterns.some((p: any) => p.id === 'seed-sine-pad')).toBe(true)
    for (const p of body.patterns) expect(p.tags).toContain('chords')
  })
})

describe('GET /api/patterns/tags', () => {
  it('returns the distinct sorted tag list', async () => {
    const { status, body } = await get('/api/patterns/tags')
    expect(status).toBe(200)
    expect(body.tags).toEqual([...body.tags].sort())
    expect(body.tags).toContain('drums')
  })
})

describe('GET /api/patterns/:id', () => {
  it('returns one pattern', async () => {
    const { status, body } = await get('/api/patterns/seed-sine-pad')
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: 'seed-sine-pad', title: 'Sine pad' })
    expect(body.tags).toContain('pad')
  })

  it('404s an unknown id', async () => {
    const { status } = await get('/api/patterns/nope')
    expect(status).toBe(404)
  })
})
