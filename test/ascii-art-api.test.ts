import { env, SELF } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

const db = env.PATTERNS_DB

async function get(path: string) {
  const res = await SELF.fetch(`https://jaime.stream${path}`)
  return { status: res.status, body: await res.json() as any }
}

beforeAll(async () => {
  await db.prepare(
    `INSERT INTO ascii_art (id, title, artist, category, subcategory, width, height, text, source_url, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    'api-test-piece',
    'Piece',
    'Tester',
    'animals',
    'cats',
    3,
    1,
    '>^<',
    'https://www.asciiart.eu/art/api-test-piece',
    '2026-09-15T00:00:00.000Z',
  ).run()
})

describe('GET /api/ascii-art/random', () => {
  it('returns a batch with every field populated', async () => {
    const { status, body } = await get('/api/ascii-art/random?count=1')
    expect(status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: expect.any(String),
      width: expect.any(Number),
      height: expect.any(Number),
      text: expect.any(String),
      sourceUrl: expect.stringContaining('asciiart.eu'),
    })
  })

  it('defaults count to 1 when omitted or invalid', async () => {
    expect((await get('/api/ascii-art/random')).body).toHaveLength(1)
    expect((await get('/api/ascii-art/random?count=not-a-number')).body).toHaveLength(1)
  })
})

describe('GET /api/ascii-art/:id', () => {
  it('returns one piece', async () => {
    const { status, body } = await get('/api/ascii-art/api-test-piece')
    expect(status).toBe(200)
    expect(body).toMatchObject({ id: 'api-test-piece', title: 'Piece', artist: 'Tester' })
  })

  it('404s an unknown id', async () => {
    const { status } = await get('/api/ascii-art/nope')
    expect(status).toBe(404)
  })
})
