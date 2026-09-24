import type { ChatMessage } from '#shared/compositionProtocol'

// Maps the room's chat log (the wire `ChatMessage`s) onto the shape Nuxt
// UI's <UChatMessages> renders (uplift-chat-interface). Purely client-side:
// the wire format is unchanged, so nothing here couples the protocol to a
// UI library.

/** `@jah`'s clientId — the server sends its replies under its own name. */
export const JAH_CLIENT_ID = '@jah'

/** `@jah`'s avatar — a static asset (the server sends the same path). */
export const JAH_AVATAR_URL = '/jah-avatar.svg'

/** Id of the synthetic "@jah is thinking…" bubble. */
export const JAH_TYPING_ID = 'jah-typing'

// CC BY 3.0: the lion is game-icons.net art by Lorc, recoloured — the
// credit rides on the avatar wherever it's shown (see
// content/credits/game-icons.md).
export const JAH_AVATAR_CREDIT = 'Lion icon by Lorc (game-icons.net, CC BY 3.0), recoloured'

export interface ChatUIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: { type: 'text', text: string }[]
  side: 'left' | 'right'
  variant: 'solid' | 'outline' | 'soft' | 'subtle' | 'naked'
  color: 'primary' | 'secondary' | 'neutral'
  avatar?: { src?: string, alt: string, text: string, title?: string, referrerpolicy?: string }
  /** Per-message slot classes: hides the empty header on own messages; keeps @jah's body text neutral. */
  ui?: { header?: string, content?: string, leadingAvatarSize?: string }
  'data-testid': string
  /** Read back in the slots (`#header`, `#content`). */
  metadata: { name: string, at: number, own: boolean, jah: boolean, typing: boolean }
}

/** The name's first character, `?` for an empty name (matches UserAvatar). */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * A message's text, with a trailing markdown "Sources: ..." line when
 * `sources` is non-empty (add-jah-knowledge-retrieval design decision 5)
 * — a deliberate v1 placeholder, rendered by the chat's existing markdown
 * support with no new component or protocol awareness in the template.
 */
function withSources(text: string, sources: ChatMessage['sources']): string {
  if (!sources || sources.length === 0) return text
  const cited = sources.map(s => (s.sourceUrl ? `[${s.title}](${s.sourceUrl})` : s.title)).join(', ')
  return `${text}\n\n*Sources: ${cited}*`
}

/**
 * `own` is decided by clientId — a reconnect gets a new one, so this
 * connection's earlier messages replayed in `welcome` show as others'
 * (design decision 2; accepted for v1).
 */
export function toChatMessages(
  chat: readonly ChatMessage[],
  ownClientId: string | undefined,
  jahTyping = false
): ChatUIMessage[] {
  const out: ChatUIMessage[] = chat.map((m, index) => {
    const jah = m.clientId === JAH_CLIENT_ID
    const own = !jah && !!ownClientId && m.clientId === ownClientId
    return {
      id: `${m.at}-${m.clientId}-${index}`,
      role: jah ? 'assistant' : 'user',
      parts: [{ type: 'text', text: withSources(m.text, m.sources) }],
      side: own ? 'right' : 'left',
      // Own: the accent bubble, set apart at a glance. Others: a quiet
      // neutral bubble. @jah: outlined and coloured, so a reply reads as
      // the assistant's without reading the name. Never `error` — red
      // would read as a failure.
      variant: own ? 'soft' : jah ? 'outline' : 'subtle',
      color: own ? 'primary' : jah ? 'secondary' : 'neutral',
      // Your own bubble needs no avatar — it is on the right, in accent.
      avatar: own
        ? undefined
        : {
            src: m.avatarUrl || undefined,
            alt: m.name,
            text: initial(m.name),
            title: jah ? JAH_AVATAR_CREDIT : undefined,
            referrerpolicy: 'no-referrer'
          },
      // The outline variant colours its text too — keep the reply readable
      // (default text); the coloured border alone marks it as the assistant.
      // `compact` avatars default to 16px — too small for a face or the lion.
      ui: own ? { header: 'hidden' } : jah ? { content: 'text-default', leadingAvatarSize: 'xs' } : { leadingAvatarSize: 'xs' },
      'data-testid': 'chat-message-row',
      metadata: { name: m.name, at: m.at, own, jah, typing: false }
    }
  })

  if (jahTyping) {
    out.push({
      id: JAH_TYPING_ID,
      role: 'assistant',
      parts: [{ type: 'text', text: '@jah is thinking…' }],
      side: 'left',
      variant: 'outline',
      color: 'secondary',
      ui: { content: 'text-default', leadingAvatarSize: 'xs' },
      avatar: { alt: JAH_CLIENT_ID, text: 'J', src: JAH_AVATAR_URL, title: JAH_AVATAR_CREDIT },
      'data-testid': 'jah-typing',
      metadata: { name: JAH_CLIENT_ID, at: 0, own: false, jah: true, typing: true }
    })
  }

  return out
}
