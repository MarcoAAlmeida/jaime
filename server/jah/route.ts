// Whether a chat message addresses `@jah` — a pure function, called
// before any account, cap, or model work (add-jah-chat design decision
// 6), so an unaddressed message costs nothing beyond this check.

import type { JahAvailability } from '../../shared/compositionProtocol'

export interface MentionClassification {
  addressed: boolean
  /** Everything after the leading "@jah" token, trimmed. Only meaningful when `addressed`. */
  rest: string
}

/** First token, case-insensitively, must be exactly `@jah` to address it. */
export function classifyMention(text: string): MentionClassification {
  const trimmed = text.trim()
  const tokens = trimmed.split(/\s+/)
  const first = tokens[0]?.toLowerCase()
  if (first !== '@jah') return { addressed: false, rest: '' }

  return { addressed: true, rest: trimmed.slice(tokens[0]!.length).trim() }
}

/**
 * The kill switch (design decision 3): `JAH_ENABLED` must be exactly
 * `'1'`, OR `JAH_E2E` is set (so a single flag fully unlocks `@jah`
 * for local dev/e2e, matching the `AUTH_E2E`/`OAUTH_E2E` precedent).
 * A pure function over the two flags so this one-line decision is
 * unit-testable without standing up a WebSocket connection — the
 * "kill switch off" case can't otherwise be exercised in this
 * project's pool-workers test env, where `.dev.vars`' `JAH_E2E=1` is
 * always present.
 */
export function isJahEnabled(env: { JAH_ENABLED?: string, JAH_E2E?: string }): boolean {
  return env.JAH_ENABLED === '1' || !!env.JAH_E2E
}

/**
 * What to tell a joining participant about `@jah` (uplift-chat-interface
 * design decision 6). Precedence matters and is the point of extracting
 * it: the kill switch beats everything (a signed-in, allowlisted user
 * still sees `disabled` while it is off), then whether they are signed
 * in at all, then whether their account has effective access. Pure so
 * the `disabled` branch is testable — through a socket the pool-workers
 * env's `JAH_E2E=1` always leaves `@jah` on.
 */
export function jahAvailability(
  env: { JAH_ENABLED?: string, JAH_E2E?: string },
  account: { aiAccess: boolean } | null,
): JahAvailability {
  if (!isJahEnabled(env)) return 'disabled'
  if (!account) return 'signed-out'
  if (!account.aiAccess) return 'no-access'
  return 'available'
}
