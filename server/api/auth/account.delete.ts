import { deleteUser } from '../../auth/users'

// DELETE /api/auth/account — remove the signed-in account and everything
// attached to it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await deleteUser(usePatternsDb(event), user.id)
  clearSessionCookie(event)
  return { ok: true }
})
