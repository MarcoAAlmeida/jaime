import { describe, expect, it } from 'vitest'
import { classifyMention, isJahEnabled, jahAvailability } from '../server/jah/route'

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

describe('jahAvailability', () => {
  const on = { JAH_ENABLED: '1', JAH_E2E: '' }
  const off = { JAH_ENABLED: '', JAH_E2E: '' }

  it('is "available" for an account with access while enabled', () => {
    expect(jahAvailability(on, { aiAccess: true })).toBe('available')
  })

  it('is "no-access" for a signed-in account without access', () => {
    expect(jahAvailability(on, { aiAccess: false })).toBe('no-access')
  })

  it('is "signed-out" with no account', () => {
    expect(jahAvailability(on, null)).toBe('signed-out')
  })

  it('is "disabled" when the kill switch is off, whoever is asking', () => {
    expect(jahAvailability(off, null)).toBe('disabled')
    expect(jahAvailability(off, { aiAccess: false })).toBe('disabled')
    // Precedence: an allowlisted account still sees "disabled", not "available".
    expect(jahAvailability(off, { aiAccess: true })).toBe('disabled')
  })

  it('follows JAH_E2E the same way isJahEnabled does', () => {
    expect(jahAvailability({ JAH_ENABLED: '', JAH_E2E: '1' }, { aiAccess: true })).toBe('available')
  })
})
