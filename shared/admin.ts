// Shapes returned by the operator-only /api/admin/* routes
// (add-admin-console), shared with app/pages/admin.vue.

export interface AdminUser {
  id: string
  displayName: string
  email: string
  githubLogin: string | null
  status: 'pending' | 'confirmed'
  createdAt: string
  /** The per-user grant. */
  aiAccess: boolean
  /** Why the account has (or hasn't) `@jah` access. */
  effectiveAccess: 'flag' | 'allowlist' | 'none'
}

export interface AiUsageRecord {
  id: string
  userId: string
  githubLogin: string | null
  roomId: string | null
  model: string
  promptTokens: number
  completionTokens: number
  costEstimateUsd: number
  createdAt: string
}
