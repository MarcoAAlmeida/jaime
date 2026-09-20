import { timingSafeEqualStrings } from '../../auth/crypto'
import { lookupSessionUser } from '../../auth/sessions'
import { usePatternsDb } from '../../utils/patternsDb'

// POST /api/session/verify  { session: "<jaime_session cookie value>" }
//   → { user: { id, displayName, avatarUrl? } } | { user: null }
//
// Internal endpoint for a sibling Worker (jaime-games) that shares the
// `.jaime.stream` cookie domain but must not read PATTERNS_DB itself.
// jaime is a public Worker, so "only reachable over the service
// binding" cannot be assumed from the platform — it is enforced here,
// by a shared secret in the `x-jaime-verify-secret` header. jaime-games
// must hold the same value as its own `GAMES_VERIFY_SECRET` Worker
// secret, set independently on that side (never committed).
//
// - Fails closed: if the secret is not configured, every request is refused.
// - Read-only: uses `lookupSessionUser`, which never slides the expiry —
//   unlike the same-origin `/api/auth/me`, this must not touch sessions.
// - Returns only id, display name and avatar URL — never the email.
// - Callers should address the binding as `https://jaime.stream/...`; a
//   `*.workers.dev` host is 301-redirected by the canonical-host middleware.
export default defineEventHandler(async (event) => {
  const env = (event.context.cloudflare as { env?: Env } | undefined)?.env
  const expected = env?.GAMES_VERIFY_SECRET
  const presented = getRequestHeader(event, 'x-jaime-verify-secret') ?? ''

  if (!expected || !(await timingSafeEqualStrings(presented, expected))) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ session?: unknown }>(event).catch(() => null)
  const session = typeof body?.session === 'string' ? body.session : ''
  if (!session) return { user: null }

  const found = await lookupSessionUser(usePatternsDb(event), session)
  if (!found) return { user: null }

  const { id, displayName, avatarUrl } = found.user
  return { user: { id, displayName, ...(avatarUrl ? { avatarUrl } : {}) } }
})
