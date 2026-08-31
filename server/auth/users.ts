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
