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
  avatar_url: string | null
  github_login: string | null
  ai_access: number
}

/**
 * Resolves a session id to its user, or null if the session is unknown
 * or expired. Read-only: it never writes, so it is safe for callers
 * that must not affect session state (the service-binding verify
 * endpoint). `lastSeenAt` lets `getSessionUser` decide whether to slide.
 */
export async function lookupSessionUser(
  db: D1Database,
  sessionId: string,
): Promise<{ user: User, lastSeenAt: string } | null> {
  const nowIso = new Date().toISOString()
  const row = await db
    .prepare(
      `SELECT s.last_seen_at, u.id, u.email, u.display_name, u.status, u.created_at,
              u.avatar_url, u.github_login, u.ai_access
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(sessionId, nowIso)
    .first<SessionUserRow>()
  if (!row) return null

  return {
    lastSeenAt: row.last_seen_at,
    user: {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      status: row.status === 'confirmed' ? 'confirmed' : 'pending',
      createdAt: row.created_at,
      aiAccess: row.ai_access === 1,
      ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
      ...(row.github_login ? { githubLogin: row.github_login } : {}),
    },
  }
}

/**
 * Resolves a session id to its user, or null if the session is unknown
 * or expired. Slides the expiry forward on use (throttled to once/day).
 */
export async function getSessionUser(db: D1Database, sessionId: string): Promise<User | null> {
  const found = await lookupSessionUser(db, sessionId)
  if (!found) return null

  const nowMs = Date.now()
  if (nowMs - Date.parse(found.lastSeenAt) > SLIDE_AFTER_MS) {
    await db
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
      .bind(new Date(nowMs).toISOString(), new Date(nowMs + SESSION_TTL_MS).toISOString(), sessionId)
      .run()
  }

  return found.user
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
}

export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
}
