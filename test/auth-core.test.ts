import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { effectiveAccess, hasAiAccess, parseAllowlist } from '../server/auth/aiAccess'
import { isOperator } from '../shared/operator'
import { issueToken, consumeToken } from '../server/auth/tokens'
import { createSession, deleteSession, deleteUserSessions, getSessionUser } from '../server/auth/sessions'
import {
  claimAuthRequestSlot,
  confirmUser,
  deleteUser,
  findOrCreateUser,
  findOrCreateUserFromGitHub,
  getUser,
  normalizeEmail,
  updateDisplayName,
} from '../server/auth/users'

const db = env.PATTERNS_DB

beforeEach(async () => {
  await db.batch([
    db.prepare('DELETE FROM sessions'),
    db.prepare('DELETE FROM auth_tokens'),
    db.prepare('DELETE FROM users'),
  ])
})

describe('users', () => {
  it('normalises email and does not create duplicates', async () => {
    const a = await findOrCreateUser(db, '  Alice@Example.COM ', 'Alice')
    const b = await findOrCreateUser(db, 'alice@example.com')
    expect(a.id).toBe(b.id)
    expect(a.email).toBe('alice@example.com')
    expect(normalizeEmail(' X@Y.Z ')).toBe('x@y.z')
  })

  it('defaults the display name to the local part when none is given', async () => {
    const u = await findOrCreateUser(db, 'bob@example.com')
    expect(u.displayName).toBe('bob')
    expect(u.status).toBe('pending')
  })

  it('confirms a pending user and stays confirmed', async () => {
    const u = await findOrCreateUser(db, 'c@example.com')
    await confirmUser(db, u.id)
    expect((await getUser(db, u.id))?.status).toBe('confirmed')
    await confirmUser(db, u.id)
    expect((await getUser(db, u.id))?.status).toBe('confirmed')
  })

  it('updates the display name, ignoring blank', async () => {
    const u = await findOrCreateUser(db, 'd@example.com', 'Dee')
    expect((await updateDisplayName(db, u.id, ' Deirdre '))?.displayName).toBe('Deirdre')
    expect((await updateDisplayName(db, u.id, '   '))?.displayName).toBe('Deirdre')
  })

  it('throttles repeated auth requests per account', async () => {
    const u = await findOrCreateUser(db, 'e@example.com')
    expect(await claimAuthRequestSlot(db, u.id)).toBe(true)
    expect(await claimAuthRequestSlot(db, u.id)).toBe(false)
  })

  it('deletes the user, its sessions and its tokens', async () => {
    const u = await findOrCreateUser(db, 'f@example.com')
    await issueToken(db, u.id)
    await createSession(db, u.id)
    await deleteUser(db, u.id)
    expect(await getUser(db, u.id)).toBeNull()
    const sessions = await db.prepare('SELECT count(*) n FROM sessions WHERE user_id = ?').bind(u.id).first<{ n: number }>()
    const tokens = await db.prepare('SELECT count(*) n FROM auth_tokens WHERE user_id = ?').bind(u.id).first<{ n: number }>()
    expect(sessions?.n).toBe(0)
    expect(tokens?.n).toBe(0)
  })
})

describe('github sign-in', () => {
  const gh = (over: Partial<Parameters<typeof findOrCreateUserFromGitHub>[1]> = {}) => ({
    githubId: 999,
    login: 'octo',
    name: 'Octo Cat',
    email: 'octo@example.com',
    avatarUrl: 'https://avatars.githubusercontent.com/u/999?v=4',
    ...over,
  })

  it('a new person gets a confirmed account with a seeded name and avatar', async () => {
    const u = await findOrCreateUserFromGitHub(db, gh())
    expect(u.status).toBe('confirmed')
    expect(u.displayName).toBe('Octo Cat')
    expect(u.avatarUrl).toBe('https://avatars.githubusercontent.com/u/999?v=4')
  })

  it('signs into an existing magic-link account for the same email, and confirms it', async () => {
    const pending = await findOrCreateUser(db, 'octo@example.com')
    expect(pending.status).toBe('pending')
    const u = await findOrCreateUserFromGitHub(db, gh())
    expect(u.id).toBe(pending.id)
    expect(u.status).toBe('confirmed')
    const count = await db.prepare('SELECT count(*) n FROM users').first<{ n: number }>()
    expect(count?.n).toBe(1)
  })

  it('a returning github user with a changed login is the same account, login refreshed', async () => {
    const first = await findOrCreateUserFromGitHub(db, gh({ login: 'octo' }))
    const again = await findOrCreateUserFromGitHub(db, gh({ login: 'octo-renamed', email: 'different@example.com' }))
    expect(again.id).toBe(first.id)
    const row = await db.prepare('SELECT github_login FROM users WHERE id = ?').bind(first.id).first<{ github_login: string }>()
    expect(row?.github_login).toBe('octo-renamed')
  })

  it('does not overwrite an edited display name on the next sign-in', async () => {
    const u = await findOrCreateUserFromGitHub(db, gh())
    await updateDisplayName(db, u.id, 'My Chosen Name')
    const again = await findOrCreateUserFromGitHub(db, gh({ name: 'Octo Cat' }))
    expect(again.displayName).toBe('My Chosen Name')
  })

  it('drops an avatar URL that is not on the GitHub avatar CDN', async () => {
    const u = await findOrCreateUserFromGitHub(db, gh({ avatarUrl: 'https://evil.example.com/track.gif' }))
    expect(u.avatarUrl).toBeUndefined()
  })

  it('a new GitHub account starts without @jah access', async () => {
    const u = await findOrCreateUserFromGitHub(db, gh())
    expect(u.aiAccess).toBe(false)
    expect(u.githubLogin).toBe('octo')
  })
})

describe('ai access resolution', () => {
  const u = (over: Partial<{ aiAccess: boolean, githubLogin?: string }> = {}) => ({
    id: 'x', email: 'x@example.com', displayName: 'X', status: 'confirmed' as const,
    createdAt: '', aiAccess: false, ...over,
  })

  it('parses the allowlist: trims, lowercases, drops blanks', () => {
    expect([...parseAllowlist(' Ada, BOB ,,  , cLARA ')]).toEqual(['ada', 'bob', 'clara'])
    expect(parseAllowlist(undefined).size).toBe(0)
    expect(parseAllowlist('').size).toBe(0)
  })

  it('grants on the per-user flag alone', () => {
    expect(hasAiAccess(u({ aiAccess: true }), parseAllowlist(''))).toBe(true)
  })

  it('grants on the allowlist alone, case-insensitively', () => {
    expect(hasAiAccess(u({ githubLogin: 'Octo' }), parseAllowlist('octo'))).toBe(true)
  })

  it('denies when neither flag nor allowlist, and for anonymous', () => {
    expect(hasAiAccess(u({ githubLogin: 'nope' }), parseAllowlist('octo'))).toBe(false)
    expect(hasAiAccess(u(), parseAllowlist('octo'))).toBe(false)
    expect(hasAiAccess(null, parseAllowlist('octo'))).toBe(false)
  })

  it('labels why access is granted (flag wins over allowlist)', () => {
    const list = parseAllowlist('octo')
    expect(effectiveAccess(u({ aiAccess: true, githubLogin: 'octo' }), list)).toBe('flag')
    expect(effectiveAccess(u({ githubLogin: 'octo' }), list)).toBe('allowlist')
    expect(effectiveAccess(u({ githubLogin: 'nope' }), list)).toBe('none')
  })
})

describe('operator identity', () => {
  it('matches on GitHub login or email, case-insensitively', () => {
    expect(isOperator({ email: 'x@example.com', githubLogin: 'MarcoAAlmeida' })).toBe(true)
    expect(isOperator({ email: 'MARCOALMEIDA.DEV.BR@gmail.com', githubLogin: undefined })).toBe(true)
    expect(isOperator({ email: 'marcoalmeida.dev.br@gmail.com', githubLogin: 'someoneelse' })).toBe(true)
  })

  it('rejects everyone else, and null', () => {
    expect(isOperator({ email: 'someone@example.com', githubLogin: 'someone' })).toBe(false)
    expect(isOperator(null)).toBe(false)
    expect(isOperator(undefined)).toBe(false)
  })
})

describe('tokens', () => {
  it('a fresh token consumes once and returns the user', async () => {
    const u = await findOrCreateUser(db, 't1@example.com')
    const raw = await issueToken(db, u.id)
    expect(await consumeToken(db, raw)).toBe(u.id)
    expect(await consumeToken(db, raw)).toBeNull() // already used
  })

  it('an unknown token is rejected', async () => {
    expect(await consumeToken(db, 'not-a-real-token')).toBeNull()
  })

  it('issuing a second token supersedes the first', async () => {
    const u = await findOrCreateUser(db, 't2@example.com')
    const first = await issueToken(db, u.id)
    const second = await issueToken(db, u.id)
    expect(await consumeToken(db, first)).toBeNull()
    expect(await consumeToken(db, second)).toBe(u.id)
  })

  it('an expired token is rejected', async () => {
    const u = await findOrCreateUser(db, 't3@example.com')
    const raw = await issueToken(db, u.id)
    await db
      .prepare('UPDATE auth_tokens SET expires_at = ? WHERE user_id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), u.id)
      .run()
    expect(await consumeToken(db, raw)).toBeNull()
  })
})

describe('sessions', () => {
  it('resolves a session to its user', async () => {
    const u = await findOrCreateUser(db, 's1@example.com', 'Sam')
    const sid = await createSession(db, u.id)
    const resolved = await getSessionUser(db, sid)
    expect(resolved?.id).toBe(u.id)
    expect(resolved?.displayName).toBe('Sam')
  })

  it('rejects an unknown or expired session', async () => {
    expect(await getSessionUser(db, 'nope')).toBeNull()
    const u = await findOrCreateUser(db, 's2@example.com')
    const sid = await createSession(db, u.id)
    await db
      .prepare('UPDATE sessions SET expires_at = ? WHERE id = ?')
      .bind(new Date(Date.now() - 1000).toISOString(), sid)
      .run()
    expect(await getSessionUser(db, sid)).toBeNull()
  })

  it('slides the expiry forward when last seen was long ago', async () => {
    const u = await findOrCreateUser(db, 's3@example.com')
    const sid = await createSession(db, u.id)
    const old = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    await db.prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(old, new Date(Date.now() + 1000).toISOString(), sid).run()
    await getSessionUser(db, sid) // triggers the slide
    const row = await db.prepare('SELECT expires_at FROM sessions WHERE id = ?').bind(sid).first<{ expires_at: string }>()
    expect(Date.parse(row!.expires_at)).toBeGreaterThan(Date.now() + 80 * 24 * 60 * 60 * 1000)
  })

  it('deletes one or all sessions for a user', async () => {
    const u = await findOrCreateUser(db, 's4@example.com')
    const a = await createSession(db, u.id)
    await createSession(db, u.id)
    await deleteSession(db, a)
    expect(await getSessionUser(db, a)).toBeNull()
    await deleteUserSessions(db, u.id)
    const n = await db.prepare('SELECT count(*) n FROM sessions WHERE user_id = ?').bind(u.id).first<{ n: number }>()
    expect(n?.n).toBe(0)
  })
})
