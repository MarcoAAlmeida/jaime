import { sendSignInEmail } from '../../auth/email'
import { issueToken } from '../../auth/tokens'
import { claimAuthRequestSlot, findOrCreateUser, isValidEmail } from '../../auth/users'

// POST /api/auth/request { email, displayName? }
// Always responds { ok: true } ("check your email") — no account
// enumeration. `devLink` is included only in dev, for the e2e tests.
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)

  const body = await readBody<{ email?: unknown, displayName?: unknown, next?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email : ''
  const displayName = typeof body?.displayName === 'string' ? body.displayName : undefined
  const next = typeof body?.next === 'string' && body.next.startsWith('/') ? body.next : undefined

  if (!isValidEmail(email.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email is required' })
  }

  const user = await findOrCreateUser(db, email, displayName)

  const env = (event.context.cloudflare as { env?: Env & { AUTH_E2E?: string } } | undefined)?.env
  // Local dev and the e2e run surface the link in the response so tests
  // (and a `npm run dev` check) don't need a real inbox. Never in prod.
  const surfaceLink = import.meta.dev || !!env?.AUTH_E2E

  let devLink: string | undefined
  if (await claimAuthRequestSlot(db, user.id)) {
    const raw = await issueToken(db, user.id)
    const nextParam = next ? `&next=${encodeURIComponent(next)}` : ''
    const path = `/auth/callback?token=${raw}${nextParam}`
    // The emailed link is always absolute on the canonical domain; the
    // dev/e2e link is a path the caller resolves against its own origin.
    if (env) await sendSignInEmail(env, user.email, `https://jaime.stream${path}`)
    if (surfaceLink) devLink = path
  }

  return { ok: true, ...(devLink ? { devLink } : {}) }
})
