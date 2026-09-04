import type { AdminUser } from '#shared/admin'
import { effectiveAccess, parseAllowlist } from '../../../auth/aiAccess'
import { setAiAccess } from '../../../auth/users'
import { requireOperator } from '../../../utils/adminAuth'

// PATCH /api/admin/users/:id { aiAccess: boolean } — flip a per-user
// `@jah` access grant.
export default defineEventHandler(async (event): Promise<AdminUser> => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)
  await requireOperator(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ aiAccess?: unknown }>(event)
  if (typeof body?.aiAccess !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'aiAccess (boolean) is required' })
  }
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'user id is required' })
  }

  const updated = await setAiAccess(db, id, body.aiAccess)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  const raw = (event.context.cloudflare as { env?: Env & { AI_ACCESS_LOGINS?: string } } | undefined)
    ?.env?.AI_ACCESS_LOGINS
  const allowlist = parseAllowlist(raw)

  return {
    id: updated.id,
    displayName: updated.displayName,
    email: updated.email,
    githubLogin: updated.githubLogin ?? null,
    status: updated.status,
    createdAt: updated.createdAt,
    aiAccess: updated.aiAccess,
    effectiveAccess: effectiveAccess(updated, allowlist),
  }
})
