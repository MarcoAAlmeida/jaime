import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { issueToken } from '../server/auth/tokens'
import { findOrCreateUser } from '../server/auth/users'

const db = env.PATTERNS_DB

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM sessions'),
    db.prepare('DELETE FROM auth_tokens'),
    db.prepare('DELETE FROM users'),
  ])
})

function base(path: string, init?: RequestInit) {
  return SELF.fetch(`https://jaime.stream${path}`, init)
}
async function request(email: string, displayName?: string) {
  return base('/api/auth/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, displayName }),
  })
}
async function tokenCount(email: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT count(*) n FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = ?`,
    )
    .bind(email)
    .first<{ n: number }>()
  return row?.n ?? 0
}
/** Sign in by minting a token straight into the DB and following the callback. */
async function signIn(email: string, displayName?: string): Promise<string> {
  const user = await findOrCreateUser(db, email, displayName)
  const raw = await issueToken(db, user.id)
  const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
  expect(res.status).toBe(302)
  const cookie = res.headers.get('set-cookie') ?? ''
  expect(cookie).toContain('jaime_session=')
  return cookie.split(';')[0]!
}

describe('POST /api/auth/request', () => {
  it('creates the account, issues a token, responds generically', async () => {
    const res = await request('new@example.com', 'New Person')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const user = await db.prepare('SELECT display_name, status FROM users WHERE email = ?').bind('new@example.com').first<{ display_name: string, status: string }>()
    expect(user).toMatchObject({ display_name: 'New Person', status: 'pending' })
    expect(await tokenCount('new@example.com')).toBe(1)
  })

  it('rejects an invalid email', async () => {
    expect((await request('not-an-email')).status).toBe(400)
  })

  it('does not reveal whether the account existed', async () => {
    await findOrCreateUser(db, 'known@example.com', 'Known')
    const a = await (await request('known@example.com')).json()
    const b = await (await request('unknown@example.com')).json()
    expect(a).toEqual(b)
    expect(a).toEqual({ ok: true })
  })

  it('throttles a second request for the same address', async () => {
    await request('t@example.com')
    await request('t@example.com')
    expect(await tokenCount('t@example.com')).toBe(1) // second throttled
  })

  it('does not create a second account for the same address', async () => {
    await request('dup@example.com')
    await db.prepare('UPDATE users SET last_auth_request_at = NULL WHERE email = ?').bind('dup@example.com').run()
    await request('dup@example.com')
    const n = await db.prepare('SELECT count(*) n FROM users WHERE email = ?').bind('dup@example.com').first<{ n: number }>()
    expect(n?.n).toBe(1)
  })
})

describe('GET /auth/callback', () => {
  it('a valid token starts a session and redirects to /', async () => {
    const user = await findOrCreateUser(db, 'cb@example.com')
    const raw = await issueToken(db, user.id)
    const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(res.headers.get('set-cookie')).toContain('jaime_session=')
  })

  it('confirms a pending account on first use', async () => {
    const user = await findOrCreateUser(db, 'confirm@example.com')
    const raw = await issueToken(db, user.id)
    await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
    const row = await db.prepare('SELECT status FROM users WHERE id = ?').bind(user.id).first<{ status: string }>()
    expect(row?.status).toBe('confirmed')
  })

  it('a used token is rejected', async () => {
    const user = await findOrCreateUser(db, 'used@example.com')
    const raw = await issueToken(db, user.id)
    await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
    const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
    expect(res.headers.get('location')).toBe('/signup?error=link')
  })

  it('an empty / bogus token redirects to the error page', async () => {
    const res = await SELF.fetch('https://jaime.stream/auth/callback?token=nope', { redirect: 'manual' })
    expect(res.headers.get('location')).toBe('/signup?error=link')
  })

  it('honours a same-origin next path', async () => {
    const user = await findOrCreateUser(db, 'n@example.com')
    const raw = await issueToken(db, user.id)
    const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}&next=/docs`, { redirect: 'manual' })
    expect(res.headers.get('location')).toBe('/docs')
  })
})

describe('session-bound routes', () => {
  it('/api/auth/me reports the user with a session and null without', async () => {
    const cookie = await signIn('me@example.com', 'Mee')
    const withSession = await (await base('/api/auth/me', { headers: { cookie } })).json() as any
    expect(withSession.user).toMatchObject({ email: 'me@example.com', displayName: 'Mee' })
    expect(await (await base('/api/auth/me')).json()).toEqual({ user: null })
  })

  it('PATCH /api/auth/me updates the name; 401 without a session', async () => {
    const cookie = await signIn('patch@example.com')
    const ok = await base('/api/auth/me', {
      method: 'PATCH',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'Renamed' }),
    })
    expect((await ok.json() as any).user.displayName).toBe('Renamed')
    const unauth = await base('/api/auth/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{"displayName":"x"}',
    })
    expect(unauth.status).toBe(401)
  })

  it('signout invalidates the session', async () => {
    const cookie = await signIn('out@example.com')
    await base('/api/auth/signout', { method: 'POST', headers: { cookie } })
    expect(await (await base('/api/auth/me', { headers: { cookie } })).json()).toEqual({ user: null })
  })

  it('signing in on a second device leaves the first alone', async () => {
    const c1 = await signIn('multi@example.com')
    const c2 = await signIn('multi@example.com')
    await base('/api/auth/signout', { method: 'POST', headers: { cookie: c2 } })
    expect(await (await base('/api/auth/me', { headers: { cookie: c1 } })).json() as any).toHaveProperty('user.email', 'multi@example.com')
  })

  it('delete-account removes the user; a fresh request makes a new pending account', async () => {
    const cookie = await signIn('del@example.com')
    await base('/api/auth/account', { method: 'DELETE', headers: { cookie } })
    expect(await db.prepare('SELECT count(*) n FROM users WHERE email = ?').bind('del@example.com').first<{ n: number }>()).toEqual({ n: 0 })
    await request('del@example.com')
    const row = await db.prepare('SELECT status FROM users WHERE email = ?').bind('del@example.com').first<{ status: string }>()
    expect(row?.status).toBe('pending')
  })
})
