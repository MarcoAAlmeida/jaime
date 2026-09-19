import type { AiUsageRecord } from '#shared/admin'
import { nanoid } from 'nanoid'

// `@jah` usage records (add-admin-console owns the read side; the write
// helper `recordUsage` lands with add-jah-chat / Phase 1). Rows are
// denormalized on `github_login` and outlive account deletion — see
// design.md decision 6.

export type { AiUsageRecord }

interface AiUsageRow {
  id: string
  user_id: string
  github_login: string | null
  room_id: string | null
  model: string
  prompt_tokens: number
  completion_tokens: number
  cost_estimate_usd: number
  created_at: string
}

function toRecord(row: AiUsageRow): AiUsageRecord {
  return {
    id: row.id,
    userId: row.user_id,
    githubLogin: row.github_login,
    roomId: row.room_id,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    costEstimateUsd: row.cost_estimate_usd,
    createdAt: row.created_at,
  }
}

/** Recent `@jah` calls, newest first. Empty until Phase 1 writes rows. */
export async function listRecentUsage(db: D1Database, limit = 50): Promise<AiUsageRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM ai_usage ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<AiUsageRow>()
  return (results ?? []).map(toRecord)
}

export interface RecordUsageInput {
  userId: string
  githubLogin: string | null
  roomId: string | null
  model: string
  promptTokens: number
  completionTokens: number
  costEstimateUsd: number
}

/** One row per real `@jah` model call — never written for a decline (design decision 2/6). */
export async function recordUsage(db: D1Database, input: RecordUsageInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ai_usage
        (id, user_id, github_login, room_id, model, prompt_tokens, completion_tokens, cost_estimate_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      nanoid(12),
      input.userId,
      input.githubLogin,
      input.roomId,
      input.model,
      input.promptTokens,
      input.completionTokens,
      input.costEstimateUsd,
      new Date().toISOString(),
    )
    .run()
}
