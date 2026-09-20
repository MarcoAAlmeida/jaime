import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { timingSafeEqualStrings } from '../server/auth/crypto'
import { createSession } from '../server/auth/sessions'
import { findOrCreateUser } from '../server/auth/users'

// add-session-verify-api — a sibling Worker resolves a `jaime_session`
// value to an identity over a shared-secret-guarded endpoint, read-only.

const db = env.PATTERNS_DB
// Set by vitest.config.ts (miniflare bindings), not .dev.vars.
const SECRET = 'test-verify-secret'

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM sessions'),
    db.prepare('DELETE FROM auth_tokens'),
    db.prepare('DELETE FROM users'),
  ])
})

function verify(body: unknown, headers: Record<string, string> = { 'x-jaime-verify-secret': SECRET }) {
  return SELF.fetch('https://jaime.stream/api/session/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function makeSession(email = 'ally@example.com', displayName = 'Ally') {
  const user = await findOrCreateUser(db, email, displayName)
  const session = await createSession(db, user.id)
  return { user, session }
}

async function sessionRow(id: string) {
  return db
    .prepare('SELECT last_seen_at, expires_at FROM sessions WHERE id = ?')
    .bind(id)
    .first<{ last_seen_at: string, expires_at: string }>()
}

describe('POST /api/session/verify', () => {
  it('returns the account for a valid secret and a valid session', async () => {
    const { user, session } = await makeSession()
    await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
      .bind('https://avatars.githubusercontent.com/u/1?s=64', user.id).run()

    const res = await verify({ session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      user: {
        id: user.id,
        displayName: 'Ally',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?s=64',
      },
    })
  })

  it('omits avatarUrl when the account has none, and never returns the email', async () => {
    const { user, session } = await makeSession('noavatar@example.com', 'NoAvatar')
    const body = await (await verify({ session })).json() as { user: Record<string, unknown> }
    expect(body.user).toEqual({ id: user.id, displayName: 'NoAvatar' })
    expect(JSON.stringify(body)).not.toContain('noavatar@example.com')
  })

  it('answers "no account" (200, user: null) for an unknown session', async () => {
    const res = await verify({ session: 'not-a-real-session' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: null })
  })

  it('answers "no account" for an expired session', async () => {
    const { session } = await makeSession()
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 60_000).toISOString(), session).run()

    const res = await verify({ session })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: null })
  })

  it('answers "no account" for a missing, non-string, or malformed body — and creates no session', async () => {
    for (const body of [{}, { session: 42 }, { session: '' }, 'not json at all']) {
      const res = await verify(body)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ user: null })
    }
    const count = await db.prepare('SELECT count(*) n FROM sessions').first<{ n: number }>()
    expect(count?.n).toBe(0)
  })

  it('refuses a request with no secret, without returning account data', async () => {
    const { session } = await makeSession()
    const res = await verify({ session }, {})
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain('Ally')
  })

  it('refuses a request with a wrong secret, without returning account data', async () => {
    const { session } = await makeSession()
    for (const wrong of ['wrong', SECRET.slice(0, -1), `${SECRET}x`, '']) {
      const res = await verify({ session }, { 'x-jaime-verify-secret': wrong })
      expect(res.status).toBe(403)
      expect(await res.text()).not.toContain('Ally')
    }
  })

  it('does not accept the session cookie as a substitute for the secret', async () => {
    const { session } = await makeSession()
    const res = await SELF.fetch('https://jaime.stream/api/session/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `jaime_session=${session}` },
      body: JSON.stringify({ session }),
    })
    expect(res.status).toBe(403)
  })

  it('has no side effects: repeated queries never slide or change the session', async () => {
    const { session } = await makeSession()
    // Old enough that a same-origin request WOULD slide it (> 1 day).
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const inAMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(twoDaysAgo, inAMonth, session).run()

    for (let i = 0; i < 3; i++) {
      expect(((await (await verify({ session })).json()) as { user: unknown }).user).not.toBeNull()
    }

    expect(await sessionRow(session)).toEqual({ last_seen_at: twoDaysAgo, expires_at: inAMonth })
  })
})

describe('same-origin current account is unchanged', () => {
  it('GET /api/auth/me still resolves the cookie and slides an old session', async () => {
    const { user, session } = await makeSession('same@example.com', 'Same')
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const inAMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(twoDaysAgo, inAMonth, session).run()

    const res = await SELF.fetch('https://jaime.stream/api/auth/me', {
      headers: { cookie: `jaime_session=${session}` },
    })
    const body = await res.json() as { user: { id: string, email: string } | null }
    expect(body.user?.id).toBe(user.id)
    expect(body.user?.email).toBe('same@example.com')

    const after = await sessionRow(session)
    expect(after?.last_seen_at).not.toBe(twoDaysAgo)
    expect(Date.parse(after!.expires_at)).toBeGreaterThan(Date.parse(inAMonth))
  })
})

describe('timingSafeEqualStrings', () => {
  it('is true only for identical strings', async () => {
    expect(await timingSafeEqualStrings('abc', 'abc')).toBe(true)
    expect(await timingSafeEqualStrings('abc', 'abd')).toBe(false)
    expect(await timingSafeEqualStrings('abc', 'abcd')).toBe(false)
    expect(await timingSafeEqualStrings('', 'abc')).toBe(false)
  })
})
