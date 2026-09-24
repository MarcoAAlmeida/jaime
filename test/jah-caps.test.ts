import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { listRecentUsage, recordUsage } from '../server/auth/aiUsage'
import { underCaps } from '../server/jah/caps'

const db = env.PATTERNS_DB
const LIMITS = { perUser: 2, global: 3 }

beforeEach(async () => {
  await db.prepare('DELETE FROM ai_usage').run()
})

async function insertUsage(userId: string, createdAt: string) {
  await db
    .prepare(
      `INSERT INTO ai_usage (id, user_id, github_login, room_id, model, prompt_tokens, completion_tokens, cost_estimate_usd, created_at)
       VALUES (?, ?, NULL, NULL, 'test-model', 1, 1, 0, ?)`,
    )
    .bind(crypto.randomUUID(), userId, createdAt)
    .run()
}

describe('underCaps', () => {
  it('is ok under both caps', async () => {
    expect(await underCaps(db, 'alice', LIMITS)).toEqual({ ok: true })
  })

  it('reports "user" once the per-user cap is reached', async () => {
    const now = new Date().toISOString()
    await insertUsage('alice', now)
    await insertUsage('alice', now)
    expect(await underCaps(db, 'alice', LIMITS)).toEqual({ ok: false, reason: 'user' })
  })

  it('reports "global" once the global cap is reached, even from other users', async () => {
    const now = new Date().toISOString()
    await insertUsage('alice', now)
    await insertUsage('bob', now)
    await insertUsage('carol', now)
    // Dana is under her own per-user cap, but the global cap is already spent.
    expect(await underCaps(db, 'dana', LIMITS)).toEqual({ ok: false, reason: 'global' })
  })

  it('resets past UTC midnight — yesterday does not count', async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    await insertUsage('alice', yesterday)
    await insertUsage('alice', yesterday)
    expect(await underCaps(db, 'alice', LIMITS)).toEqual({ ok: true })
  })
})

describe('recordUsage', () => {
  it('writes a row readable via listRecentUsage', async () => {
    await recordUsage(db, {
      userId: 'alice',
      githubLogin: 'alice-gh',
      roomId: 'room-1',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      promptTokens: 42,
      completionTokens: 7,
      costEstimateUsd: 0.001,
      retrievalChunksUsed: 3,
      embeddingTokens: 0,
    })
    const rows = await listRecentUsage(db)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      userId: 'alice',
      githubLogin: 'alice-gh',
      roomId: 'room-1',
      model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      promptTokens: 42,
      completionTokens: 7,
      retrievalChunksUsed: 3,
      embeddingTokens: 0,
    })
  })
})
