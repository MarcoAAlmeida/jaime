import { describe, expect, it } from 'vitest'
import { withJahMention } from '../app/lib/jahMention'
import { classifyMention } from '../server/jah/route'

describe('withJahMention (the "to @jah" switch)', () => {
  it('prepends @jah to an ordinary message', () => {
    expect(withJahMention('what does .fast do?')).toBe('@jah what does .fast do?')
  })

  it('does not double an existing leading mention', () => {
    expect(withJahMention('@jah hello')).toBe('@jah hello')
    expect(withJahMention('  @JAH   hello  ')).toBe('@JAH   hello')
  })

  it('keeps a multi-line message intact', () => {
    expect(withJahMention('line one\nline two')).toBe('@jah line one\nline two')
  })

  it('prefixes a mention that is not the first token', () => {
    expect(withJahMention('hey @jah')).toBe('@jah hey @jah')
  })

  it('always yields a message the server treats as addressed to @jah', () => {
    for (const text of [
      'hello', '@jah hi', '@JAH hi', '@jah, hi', '@jahn hi', '@jah', 'fix this',
      'hey @jah', '@jah\nnext line', '  spaced  ', '@jah fix the kick',
    ]) {
      expect(classifyMention(withJahMention(text)).addressed, JSON.stringify(text)).toBe(true)
    }
  })

  it('preserves the reserved fix/edit keyword when the user typed the mention', () => {
    expect(classifyMention(withJahMention('@jah fix the kick')).kind).toBe('fix')
  })
})
