import { randomToken, sha256Hex } from './crypto'

const TOKEN_TTL_MS = 15 * 60 * 1000

/**
 * Issues a sign-in token for a user. Only the SHA-256 hash is stored;
 * the raw value (returned here, put in the emailed link) never touches
 * the database. Any prior unused token for the user is dropped so only
 * the latest link is valid.
 */
export async function issueToken(db: D1Database, userId: string): Promise<string> {
  const raw = randomToken(32)
  const hash = await sha256Hex(raw)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()

  await db
    .prepare('DELETE FROM auth_tokens WHERE user_id = ? AND used_at IS NULL')
    .bind(userId)
    .run()
  await db
    .prepare('INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(hash, userId, expiresAt)
    .run()
  return raw
}

/**
 * Validates and burns a token. Returns the user id on success, or null
 * if the token is unknown, already used, or expired.
 */
export async function consumeToken(db: D1Database, raw: string): Promise<string | null> {
  const hash = await sha256Hex(raw)
  const now = new Date().toISOString()
  const row = await db
    .prepare(
      `SELECT user_id FROM auth_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .bind(hash, now)
    .first<{ user_id: string }>()
  if (!row) return null

  await db
    .prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?')
    .bind(now, hash)
    .run()
  return row.user_id
}
