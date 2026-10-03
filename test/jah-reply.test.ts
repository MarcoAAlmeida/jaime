import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, JAH_SYSTEM_PROMPT } from '../server/jah/prompt'
import { generateJahReply } from '../server/jah/reply'

describe('generateJahReply', () => {
  it('with JAH_E2E set, returns the canned reply and never touches env.AI', async () => {
    const calls: unknown[] = []
    const fakeAi = { run: (...args: unknown[]) => { calls.push(args); throw new Error('should not be called') } }
    const reply = await generateJahReply({ ...env, AI: fakeAi as never, JAH_E2E: '1' }, [
      { role: 'user', content: '@jah what does .fast do?' },
    ])

    expect(reply.text).toMatch(/canned/i)
    // ...and carries a fenced strudel block so the chat can show a card.
    expect(reply.text).toMatch(/^```strudel\n[^\n]+\n```$/m)
    expect(reply.promptTokens).toBe(0)
    expect(reply.completionTokens).toBe(0)
    expect(reply.costEstimateUsd).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it('with JAH_E2E set, contextBlocks are accepted but the canned reply is unaffected (add-jah-knowledge-retrieval)', async () => {
    const reply = await generateJahReply({ ...env, JAH_E2E: '1' }, [{ role: 'user', content: 'hi' }], ['some retrieved context'])
    expect(reply.text).toMatch(/canned/i)
  })
})

describe('JAH_SYSTEM_PROMPT', () => {
  it('asks for a playing example in a strudel-labelled fence', () => {
    expect(JAH_SYSTEM_PROMPT).toMatch(/playing example is always welcome/i)
    expect(JAH_SYSTEM_PROMPT).toMatch(/fenced block labelled\s+strudel/i)
  })

  it('points at the clean-breaks pack for breakbeats and forbids invented packs', () => {
    expect(JAH_SYSTEM_PROMPT).toContain("samples('github:yaxu/clean-breaks/main')")
    expect(JAH_SYSTEM_PROMPT).toMatch(/never invent a sample pack/i)
  })

  it('keeps the existing identity and cheatsheet', () => {
    expect(JAH_SYSTEM_PROMPT).toContain('You are @jah')
    expect(JAH_SYSTEM_PROMPT).toContain('Strudel core-function reference')
  })
})

describe('buildSystemPrompt', () => {
  it('with no context blocks, is byte-identical to JAH_SYSTEM_PROMPT (add-jah-knowledge-retrieval)', () => {
    expect(buildSystemPrompt()).toBe(JAH_SYSTEM_PROMPT)
    expect(buildSystemPrompt([])).toBe(JAH_SYSTEM_PROMPT)
  })

  it('includes every context block\'s text, in order', () => {
    const prompt = buildSystemPrompt(['FIRST BLOCK TEXT', 'SECOND BLOCK TEXT'])
    expect(prompt).toContain('FIRST BLOCK TEXT')
    expect(prompt).toContain('SECOND BLOCK TEXT')
    expect(prompt.indexOf('FIRST BLOCK TEXT')).toBeLessThan(prompt.indexOf('SECOND BLOCK TEXT'))
  })

  it('with context, still keeps the identity, cheatsheet, and examples section', () => {
    const prompt = buildSystemPrompt(['some retrieved text'])
    expect(prompt).toContain('You are @jah')
    expect(prompt).toContain('Strudel core-function reference')
    expect(prompt).toMatch(/playing example is always welcome/i)
  })

  it('with no scriptContext, is still byte-identical to JAH_SYSTEM_PROMPT (add-jah-script-context)', () => {
    expect(buildSystemPrompt([])).toBe(JAH_SYSTEM_PROMPT)
    expect(buildSystemPrompt([], undefined)).toBe(JAH_SYSTEM_PROMPT)
  })

  it('a scriptContext includes the script and says nothing is selected when there is no selection', () => {
    const prompt = buildSystemPrompt([], { script: 's("bd sd")', truncated: false })
    expect(prompt).toContain('s("bd sd")')
    expect(prompt).toMatch(/nothing is currently selected/i)
  })

  it('a scriptContext with a selection includes both, distinctly', () => {
    const prompt = buildSystemPrompt([], { script: 's("bd sd").fast(2)', selection: '.fast(2)', truncated: false })
    expect(prompt).toContain('s("bd sd").fast(2)')
    expect(prompt).toMatch(/has this part selected[\s\S]*\.fast\(2\)/i)
  })

  it('a truncated scriptContext tells @jah the full script did not fit', () => {
    const prompt = buildSystemPrompt([], { script: 's("bd")', truncated: true })
    expect(prompt).toMatch(/too large to include in full/i)
  })

  it('scriptContext and reference material coexist', () => {
    const prompt = buildSystemPrompt(['some retrieved text'], { script: 's("bd")', truncated: false })
    expect(prompt).toContain('s("bd")')
    expect(prompt).toContain('some retrieved text')
  })
})
