import type { User } from '#shared/user'
import { nanoid } from 'nanoid'

export type { User } from '#shared/user'

interface UserRow {
  id: string
  email: string
  display_name: string
  status: string
  created_at: string
  last_auth_request_at: string | null
  github_id: number | null
  github_login: string | null
  avatar_url: string | null
}

// A new sign-in link may only be requested this often per account.
const THROTTLE_MS = 60 * 1000

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status === 'confirmed' ? 'confirmed' : 'pending',
    createdAt: row.created_at,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
  }
}

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<UserRow>()
  return row ? toUser(row) : null
}

export async function findOrCreateUser(
  db: D1Database,
  email: string,
  displayName?: string,
): Promise<User> {
  const normalized = normalizeEmail(email)
  const existing = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(normalized)
    .first<UserRow>()
  if (existing) return toUser(existing)

  const id = nanoid(12)
  const now = new Date().toISOString()
  const name = displayName?.trim() || normalized.split('@')[0]!
  await db
    .prepare(
      'INSERT INTO users (id, email, display_name, status, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(id, normalized, name, 'pending', now)
    .run()
  return { id, email: normalized, displayName: name, status: 'pending', createdAt: now }
}

export async function confirmUser(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE users SET status = 'confirmed' WHERE id = ? AND status = 'pending'`)
    .bind(id)
    .run()
}

// Only GitHub's own avatar CDN — an arbitrary URL rendered in every
// other participant's DOM is a tracking / content-injection vector.
export function sanitizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname === 'avatars.githubusercontent.com' ? url : null
  }
  catch {
    return null
  }
}

export interface GitHubProfile {
  githubId: number
  login: string
  name?: string | null
  email: string
  avatarUrl?: string | null
}

/**
 * Resolve a jaime account for a GitHub sign-in. Matches on `github_id`
 * first (stable), then verified email (attaching the GitHub identity to
 * a magic-link account and confirming it), else creates a confirmed
 * account. Never overwrites `display_name` — the user may have edited it.
 */
export async function findOrCreateUserFromGitHub(
  db: D1Database,
  profile: GitHubProfile,
): Promise<User> {
  const email = normalizeEmail(profile.email)
  const avatar = sanitizeAvatarUrl(profile.avatarUrl)

  const byGithub = await db
    .prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(profile.githubId)
    .first<UserRow>()
  if (byGithub) {
    await db
      .prepare('UPDATE users SET github_login = ?, avatar_url = ? WHERE id = ?')
      .bind(profile.login, avatar, byGithub.id)
      .run()
    return getUser(db, byGithub.id) as Promise<User>
  }

  const byEmail = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>()
  if (byEmail) {
    await db
      .prepare(
        `UPDATE users SET github_id = ?, github_login = ?, avatar_url = ?, status = 'confirmed' WHERE id = ?`,
      )
      .bind(profile.githubId, profile.login, avatar, byEmail.id)
      .run()
    return getUser(db, byEmail.id) as Promise<User>
  }

  const id = nanoid(12)
  const now = new Date().toISOString()
  const name = profile.name?.trim() || profile.login
  await db
    .prepare(
      `INSERT INTO users (id, email, display_name, status, created_at, github_id, github_login, avatar_url)
       VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
    )
    .bind(id, email, name, now, profile.githubId, profile.login, avatar)
    .run()
  return {
    id,
    email,
    displayName: name,
    status: 'confirmed',
    createdAt: now,
    ...(avatar ? { avatarUrl: avatar } : {}),
  }
}

export async function updateDisplayName(
  db: D1Database,
  id: string,
  displayName: string,
): Promise<User | null> {
  const name = displayName.trim()
  if (!name) return getUser(db, id)
  await db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name, id).run()
  return getUser(db, id)
}

/** Removes the user and everything hanging off it. */
export async function deleteUser(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await db.prepare('DELETE FROM auth_tokens WHERE user_id = ?').bind(id).run()
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
}

/**
 * Returns true (and stamps "now") if this account may request a sign-in
 * link right now; false if it did so within the throttle window.
 */
export async function claimAuthRequestSlot(db: D1Database, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT last_auth_request_at FROM users WHERE id = ?')
    .bind(userId)
    .first<{ last_auth_request_at: string | null }>()
  if (
    row?.last_auth_request_at
    && Date.now() - Date.parse(row.last_auth_request_at) < THROTTLE_MS
  ) {
    return false
  }
  await db
    .prepare('UPDATE users SET last_auth_request_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), userId)
    .run()
  return true
}
