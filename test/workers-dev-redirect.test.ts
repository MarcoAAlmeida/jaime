import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

// server/middleware/workers-dev-redirect.ts — the default *.workers.dev
// URL stays deployed only to 301 onward to the canonical jaime.stream
// domain (frontend-editor spec: "Static Deployment").
describe('workers.dev → jaime.stream redirect', () => {
  it('301s a *.workers.dev request to the same path + query on jaime.stream', async () => {
    const res = await SELF.fetch(
      'https://jaime.marcoalmeida-dev-br.workers.dev/app/jam/room/abc?x=1',
      { redirect: 'manual' },
    )
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://jaime.stream/app/jam/room/abc?x=1')
  })

  it('301s the *.workers.dev site root to jaime.stream', async () => {
    const res = await SELF.fetch('https://jaime.marcoalmeida-dev-br.workers.dev/', {
      redirect: 'manual',
    })
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://jaime.stream/')
  })

  it('leaves a request already on the canonical domain alone', async () => {
    const res = await SELF.fetch('https://jaime.stream/', { redirect: 'manual' })
    expect(res.status).toBe(200)
  })
})
