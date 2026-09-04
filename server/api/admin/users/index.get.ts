import type { AdminUser } from '#shared/admin'
import { effectiveAccess, parseAllowlist } from '../../../auth/aiAccess'
import { listUsers } from '../../../auth/users'
import { requireOperator } from '../../../utils/adminAuth'

// GET /api/admin/users — the operator's account roster.
export default defineEventHandler(async (event): Promise<AdminUser[]> => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)
  await requireOperator(event)

  const raw = (event.context.cloudflare as { env?: Env & { AI_ACCESS_LOGINS?: string } } | undefined)
    ?.env?.AI_ACCESS_LOGINS
  const allowlist = parseAllowlist(raw)

  const users = await listUsers(db)
  return users.map(u => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    githubLogin: u.githubLogin ?? null,
    status: u.status,
    createdAt: u.createdAt,
    aiAccess: u.aiAccess,
    effectiveAccess: effectiveAccess(u, allowlist),
  }))
})
