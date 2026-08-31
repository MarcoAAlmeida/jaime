import { updateDisplayName } from '../../auth/users'

// PATCH /api/auth/me { displayName } — update the signed-in account.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ displayName?: unknown }>(event)
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName) {
    throw createError({ statusCode: 400, statusMessage: 'displayName is required' })
  }
  const updated = await updateDisplayName(usePatternsDb(event), user.id, displayName)
  return { user: updated }
})
