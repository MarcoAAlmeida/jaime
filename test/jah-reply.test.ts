import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { generateJahReply } from '../server/jah/reply'

describe('generateJahReply', () => {
  it('with JAH_E2E set, returns the canned reply and never touches env.AI', async () => {
    const calls: unknown[] = []
    const fakeAi = { run: (...args: unknown[]) => { calls.push(args); throw new Error('should not be called') } }
    const reply = await generateJahReply({ ...env, AI: fakeAi as never, JAH_E2E: '1' }, [
      { role: 'user', content: '@jah what does .fast do?' },
    ])

    expect(reply.text).toMatch(/canned/i)
    expect(reply.promptTokens).toBe(0)
    expect(reply.completionTokens).toBe(0)
    expect(reply.costEstimateUsd).toBe(0)
    expect(calls).toHaveLength(0)
  })
})
