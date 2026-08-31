import type { User } from '#shared/user'
import { randomToken } from './crypto'

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000 // bump expiry at most once/day

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const id = randomToken(32)
  const now = new Date()
  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      now.toISOString(),
      now.toISOString(),
      new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    )
    .run()
  return id
}

interface SessionUserRow {
  last_seen_at: string
  id: string
  email: string
  display_name: string
  status: string
  created_at: string
}

/**
 * Resolves a session id to its user, or null if the session is unknown
 * or expired. Slides the expiry forward on use (throttled to once/day).
 */
export async function getSessionUser(db: D1Database, sessionId: string): Promise<User | null> {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  const row = await db
    .prepare(
      `SELECT s.last_seen_at, u.id, u.email, u.display_name, u.status, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, nowIso)
    .first<SessionUserRow>()
  if (!row) return null

  if (nowMs - Date.parse(row.last_seen_at) > SLIDE_AFTER_MS) {
    await db
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(nowIso, new Date(nowMs + SESSION_TTL_MS).toISOString(), sessionId)
      .run()
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status === 'confirmed' ? 'confirmed' : 'pending',
    createdAt: row.created_at,
  }
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
}

export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}
