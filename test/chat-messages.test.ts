import { describe, expect, it } from 'vitest'
import { JAH_AVATAR_CREDIT, JAH_TYPING_ID, toChatMessages } from '../app/lib/chatMessages'
import type { ChatMessage } from '../shared/compositionProtocol'

const alice: ChatMessage = { clientId: 'c1', name: 'Alice', text: 'hey room', at: 1000, avatarUrl: 'https://avatars.githubusercontent.com/u/1' }
const vic: ChatMessage = { clientId: 'c2', name: 'Vic', text: 'sounds good', at: 2000 }
const jah: ChatMessage = { clientId: '@jah', name: '@jah', text: 'try `.fast(2)`', at: 3000, avatarUrl: '/jah-avatar.svg' }

describe('toChatMessages', () => {
  it('sets the viewer’s own message apart: right, accent, no avatar, header hidden', () => {
    const [m] = toChatMessages([alice], 'c1')
    expect(m).toMatchObject({ role: 'user', side: 'right', variant: 'soft', color: 'primary' })
    expect(m!.avatar).toBeUndefined()
    expect(m!.ui?.header).toBe('hidden')
    expect(m!.metadata.own).toBe(true)
  })

  it('shows another participant on the left, quiet, with their avatar', () => {
    const [m] = toChatMessages([alice], 'c2')
    expect(m).toMatchObject({ role: 'user', side: 'left', variant: 'subtle', color: 'neutral' })
    expect(m!.avatar).toMatchObject({ src: 'https://avatars.githubusercontent.com/u/1', alt: 'Alice', text: 'A' })
    expect(m!.avatar!.referrerpolicy).toBe('no-referrer')
    expect(m!.ui?.header).toBeUndefined()
    expect(m!.metadata).toMatchObject({ name: 'Alice', own: false, jah: false })
  })

  it('presents @jah as the assistant, distinct from both, and never as an error', () => {
    const [m] = toChatMessages([jah], 'c1')
    expect(m).toMatchObject({ role: 'assistant', side: 'left', variant: 'outline', color: 'secondary' })
    expect(m!.avatar).toMatchObject({ src: '/jah-avatar.svg', alt: '@jah', title: JAH_AVATAR_CREDIT })
    expect(m!.metadata.jah).toBe(true)
    const [own, other] = toChatMessages([alice, vic], 'c1')
    for (const human of [own!, other!]) {
      expect(human.variant === m!.variant && human.color === m!.color).toBe(false)
    }
    expect(m!.color).not.toBe('error')
  })

  it('never treats @jah as the viewer, even with a matching clientId', () => {
    const [m] = toChatMessages([jah], '@jah')
    expect(m!.metadata.own).toBe(false)
    expect(m!.role).toBe('assistant')
  })

  it('falls back to the name’s initial when there is no avatarUrl', () => {
    const [m] = toChatMessages([vic], 'c1')
    expect(m!.avatar).toMatchObject({ src: undefined, text: 'V' })
    const [blank] = toChatMessages([{ ...vic, name: '  ' }], 'c1')
    expect(blank!.avatar!.text).toBe('?')
  })

  it('treats everything as others’ before the viewer’s clientId is known', () => {
    expect(toChatMessages([alice, vic], undefined).every(m => !m.metadata.own)).toBe(true)
  })

  it('carries the text as one non-empty text part and the row testid', () => {
    const [m] = toChatMessages([alice], 'c1')
    expect(m!.parts).toEqual([{ type: 'text', text: 'hey room' }])
    expect(m!['data-testid']).toBe('chat-message-row')
  })

  it('gives stable, unique ids across appends, even for identical messages', () => {
    const dup = { ...alice }
    const before = toChatMessages([alice, vic, dup], 'c1').map(m => m.id)
    expect(new Set(before).size).toBe(3)
    const after = toChatMessages([alice, vic, dup, jah], 'c1').map(m => m.id)
    expect(after.slice(0, 3)).toEqual(before)
  })

  it('appends the typing bubble only while @jah is typing, and only at the end', () => {
    expect(toChatMessages([alice], 'c1').some(m => m.id === JAH_TYPING_ID)).toBe(false)
    const withTyping = toChatMessages([alice, vic], 'c1', true)
    const last = withTyping.at(-1)!
    expect(withTyping).toHaveLength(3)
    expect(last).toMatchObject({ id: JAH_TYPING_ID, role: 'assistant', 'data-testid': 'jah-typing' })
    expect(last.metadata.typing).toBe(true)
    expect(last.parts[0]!.text.length).toBeGreaterThan(0)
    // …and it is the only typing message.
    expect(withTyping.filter(m => m.metadata.typing)).toHaveLength(1)
  })

  it('shows the typing bubble in an otherwise empty log', () => {
    expect(toChatMessages([], 'c1', true)).toHaveLength(1)
    expect(toChatMessages([], 'c1', false)).toHaveLength(0)
  })
})
