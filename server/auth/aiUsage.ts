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
  retrieval_chunks_used: number
  embedding_tokens: number
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
    retrievalChunksUsed: row.retrieval_chunks_used,
    embeddingTokens: row.embedding_tokens,
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
  /** `sources.length` from retrieval (add-jah-knowledge-retrieval); `0` for an ungrounded reply. */
  retrievalChunksUsed: number
  /** Reserved: always `0` today — see migration 0011's comment. */
  embeddingTokens: number
}

/** One row per real `@jah` model call — never written for a decline (design decision 2/6). */
export async function recordUsage(db: D1Database, input: RecordUsageInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ai_usage
        (id, user_id, github_login, room_id, model, prompt_tokens, completion_tokens, cost_estimate_usd, retrieval_chunks_used, embedding_tokens, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.retrievalChunksUsed,
      input.embeddingTokens,
      new Date().toISOString(),
    )
    .run()
}
