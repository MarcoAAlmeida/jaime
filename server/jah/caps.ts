// Daily spend caps for `@jah` (add-jah-chat design decision 2). No new
// counter table: `ai_usage` (add-admin-console) is both the audit
// trail and the cap source of truth, counted since UTC day start.

export interface CapLimits {
  perUser: number
  global: number
}

export interface CapCheck {
  ok: boolean
  reason?: 'user' | 'global'
}

function utcDayStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

async function countSince(db: D1Database, since: string, userId?: string): Promise<number> {
  const query = userId
    ? db.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE user_id = ? AND created_at >= ?').bind(userId, since)
    : db.prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE created_at >= ?').bind(since)
  const row = await query.first<{ n: number }>()
  return row?.n ?? 0
}

/** Whether a request from `userId` is under both the per-user and global daily caps. */
export async function underCaps(db: D1Database, userId: string, limits: CapLimits): Promise<CapCheck> {
  const since = utcDayStart()

  const userCount = await countSince(db, since, userId)
  if (userCount >= limits.perUser) return { ok: false, reason: 'user' }

  const globalCount = await countSince(db, since)
  if (globalCount >= limits.global) return { ok: false, reason: 'global' }

  return { ok: true }
}
