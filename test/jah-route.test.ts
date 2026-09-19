import { describe, expect, it } from 'vitest'
import { classifyMention, isJahEnabled } from '../server/jah/route'

describe('classifyMention', () => {
  it('is not addressed when there is no mention', () => {
    expect(classifyMention('what does .fast do?')).toEqual({ addressed: false, kind: 'discussion', rest: '' })
  })

  it('is not addressed when @jah appears mid-message', () => {
    expect(classifyMention('ask @jah about this')).toEqual({ addressed: false, kind: 'discussion', rest: '' })
  })

  it('is addressed and discussion for a plain question', () => {
    expect(classifyMention('@jah what does .fast do?')).toEqual({
      addressed: true,
      kind: 'discussion',
      rest: 'what does .fast do?',
    })
  })

  it('is addressed and discussion when there is nothing after the mention', () => {
    expect(classifyMention('@jah')).toEqual({ addressed: true, kind: 'discussion', rest: '' })
  })

  it('is addressed and fix for the reserved fix keyword', () => {
    expect(classifyMention('@jah fix my kick pattern')).toEqual({
      addressed: true,
      kind: 'fix',
      rest: 'fix my kick pattern',
    })
  })

  it('is addressed and edit for the reserved edit keyword', () => {
    expect(classifyMention('@jah edit the bassline')).toEqual({
      addressed: true,
      kind: 'edit',
      rest: 'edit the bassline',
    })
  })

  it('is case-insensitive for the mention', () => {
    expect(classifyMention('@JaH what does .fast do?')).toEqual({
      addressed: true,
      kind: 'discussion',
      rest: 'what does .fast do?',
    })
  })

  it('is case-insensitive for the reserved keyword', () => {
    expect(classifyMention('@jah FIX my kick pattern')).toEqual({
      addressed: true,
      kind: 'fix',
      rest: 'FIX my kick pattern',
    })
  })
})

describe('isJahEnabled', () => {
  it('is disabled when neither flag is set', () => {
    expect(isJahEnabled({ JAH_ENABLED: '', JAH_E2E: '' })).toBe(false)
  })

  it('is enabled when JAH_ENABLED is exactly "1"', () => {
    expect(isJahEnabled({ JAH_ENABLED: '1', JAH_E2E: '' })).toBe(true)
  })

  it('is disabled when JAH_ENABLED is truthy but not exactly "1"', () => {
    expect(isJahEnabled({ JAH_ENABLED: 'true', JAH_E2E: '' })).toBe(false)
  })

  it('is enabled when JAH_E2E is set, regardless of JAH_ENABLED', () => {
    expect(isJahEnabled({ JAH_ENABLED: '', JAH_E2E: '1' })).toBe(true)
  })
})
