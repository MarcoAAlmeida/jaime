import { env } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { getAsciiArtById, getRandomAsciiArt, isAsciiArtMigrated } from '../server/catalog/asciiArt'

const db = env.PATTERNS_DB

const FIXTURES = [
  { id: 'test-cat', title: 'Cat', artist: 'Tester', category: 'animals', subcategory: 'cats', width: 7, height: 3, text: '/\\_/\\\n( o.o )\n > ^ <' },
  { id: 'test-unknown', title: null, artist: null, category: 'animals', subcategory: 'dogs', width: 5, height: 1, text: 'woof!' },
  { id: 'test-banner', title: 'Banner', artist: 'Someone', category: 'logos', subcategory: 'text', width: 20, height: 2, text: '####################\n#      jaime       #' },
]

beforeAll(async () => {
  for (const f of FIXTURES) {
    await db.prepare(
      `INSERT INTO ascii_art (id, title, artist, category, subcategory, width, height, text, source_url, scraped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      f.id,
      f.title,
      f.artist,
      f.category,
      f.subcategory,
      f.width,
      f.height,
      f.text,
      `https://www.asciiart.eu/art/${f.id}`,
      '2026-09-15T00:00:00.000Z',
    ).run()
  }
})

describe('isAsciiArtMigrated', () => {
  it('is true once the 0007 migration has run', async () => {
    expect(await isAsciiArtMigrated(db)).toBe(true)
  })
})

describe('getAsciiArtById', () => {
  it('returns the full shape, camelCased', async () => {
    const piece = await getAsciiArtById(db, 'test-cat')
    expect(piece).toMatchObject({
      id: 'test-cat',
      title: 'Cat',
      artist: 'Tester',
      width: 7,
      height: 3,
      sourceUrl: 'https://www.asciiart.eu/art/test-cat',
    })
    expect(piece?.text).toContain('o.o')
  })

  it('passes through null title/artist for unattributed pieces', async () => {
    const piece = await getAsciiArtById(db, 'test-unknown')
    expect(piece?.title).toBeNull()
    expect(piece?.artist).toBeNull()
  })

  it('returns null for an unknown id', async () => {
    expect(await getAsciiArtById(db, 'nope')).toBeNull()
  })
})

describe('getRandomAsciiArt', () => {
  it('returns distinct pieces from the seeded set', async () => {
    const batch = await getRandomAsciiArt(db, 3)
    expect(batch).toHaveLength(3)
    const ids = new Set(batch.map(p => p.id))
    expect(ids.size).toBe(3)
    for (const p of batch) {
      expect(FIXTURES.some(f => f.id === p.id)).toBe(true)
    }
  })

  it('clamps count to at least 1 and at most 100', async () => {
    expect(await getRandomAsciiArt(db, 0)).toHaveLength(1)
    expect(await getRandomAsciiArt(db, -5)).toHaveLength(1)
    // Only 3 rows exist regardless of how high count is asked.
    expect(await getRandomAsciiArt(db, 500)).toHaveLength(3)
  })
})
