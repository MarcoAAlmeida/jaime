import type { AiUsageRecord } from '#shared/admin'
import { listRecentUsage } from '../../auth/aiUsage'
import { requireOperator } from '../../utils/adminAuth'

// GET /api/admin/usage?limit=50 — recent `@jah` calls, newest first.
// Empty until add-jah-chat (Phase 1) writes rows.
export default defineEventHandler(async (event): Promise<AiUsageRecord[]> => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)
  await requireOperator(event)

  const raw = Number(getQuery(event).limit)
  const limit = Number.isFinite(raw) ? Math.min(200, Math.max(1, Math.trunc(raw))) : 50

  return listRecentUsage(db, limit)
})
