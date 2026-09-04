import { SELF, env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { issueToken } from '../server/auth/tokens'
import { findOrCreateUser } from '../server/auth/users'

const db = env.PATTERNS_DB
const OPERATOR_EMAIL = 'marcoalmeida.dev.br@gmail.com'

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM sessions'),
    db.prepare('DELETE FROM auth_tokens'),
    db.prepare('DELETE FROM ai_usage'),
    db.prepare('DELETE FROM users'),
  ])
})

/** Sign in by minting a token straight into the DB and following the callback. */
async function signIn(email: string): Promise<string> {
  const user = await findOrCreateUser(db, email)
  const raw = await issueToken(db, user.id)
  const res = await SELF.fetch(`https://jaime.stream/auth/callback?token=${raw}`, { redirect: 'manual' })
  expect(res.status).toBe(302)
  return (res.headers.get('set-cookie') ?? '').split(';')[0]!
}

function admin(path: string, cookie?: string, init: RequestInit = {}) {
  return SELF.fetch(`https://jaime.stream${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) },
  })
}

describe('GET /api/admin/users', () => {
  it('the operator sees every account', async () => {
    await findOrCreateUser(db, 'alice@example.com', 'Alice')
    const cookie = await signIn(OPERATOR_EMAIL)
    const res = await admin('/api/admin/users', cookie)
    expect(res.status).toBe(200)
    const rows = await res.json() as Array<{ email: string, effectiveAccess: string }>
    expect(rows.map(r => r.email).sort()).toEqual(['alice@example.com', OPERATOR_EMAIL])
  })

  it('a signed-in non-operator gets a 404, no data', async () => {
    const cookie = await signIn('nobody@example.com')
    const res = await admin('/api/admin/users', cookie)
    expect(res.status).toBe(404)
  })

  it('an anonymous request gets a 404', async () => {
    expect((await admin('/api/admin/users')).status).toBe(404)
  })
})

describe('PATCH /api/admin/users/:id', () => {
  it('the operator flips a per-user grant and the roster reflects it', async () => {
    const target = await findOrCreateUser(db, 'grantee@example.com')
    const cookie = await signIn(OPERATOR_EMAIL)

    const patched = await admin(`/api/admin/users/${target.id}`, cookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aiAccess: true }),
    })
    expect(patched.status).toBe(200)
    expect(await patched.json()).toMatchObject({ aiAccess: true, effectiveAccess: 'flag' })

    const rows = await (await admin('/api/admin/users', cookie)).json() as Array<{ email: string, aiAccess: boolean }>
    expect(rows.find(r => r.email === 'grantee@example.com')?.aiAccess).toBe(true)
  })

  it('a bad body is a 400', async () => {
    const target = await findOrCreateUser(db, 'x@example.com')
    const cookie = await signIn(OPERATOR_EMAIL)
    const res = await admin(`/api/admin/users/${target.id}`, cookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aiAccess: 'yes' }),
    })
    expect(res.status).toBe(400)
  })

  it('an unknown id is a 404', async () => {
    const cookie = await signIn(OPERATOR_EMAIL)
    const res = await admin('/api/admin/users/does-not-exist', cookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aiAccess: true }),
    })
    expect(res.status).toBe(404)
  })

  it('a non-operator cannot toggle', async () => {
    const target = await findOrCreateUser(db, 'y@example.com')
    const cookie = await signIn('nobody@example.com')
    const res = await admin(`/api/admin/users/${target.id}`, cookie, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ aiAccess: true }),
    })
    expect(res.status).toBe(404)
    const row = await db.prepare('SELECT ai_access FROM users WHERE id = ?').bind(target.id).first<{ ai_access: number }>()
    expect(row?.ai_access).toBe(0)
  })
})

describe('GET /api/admin/usage', () => {
  it('returns an empty list cleanly before any @jah call', async () => {
    const cookie = await signIn(OPERATOR_EMAIL)
    const res = await admin('/api/admin/usage', cookie)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('a non-operator gets a 404', async () => {
    const cookie = await signIn('nobody@example.com')
    expect((await admin('/api/admin/usage', cookie)).status).toBe(404)
  })
})
