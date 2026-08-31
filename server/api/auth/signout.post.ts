import { deleteSession } from '../../auth/sessions'

// POST /api/auth/signout — end the current session.
export default defineEventHandler(async (event) => {
  const sessionId = readSessionCookie(event)
  if (sessionId) {
    await deleteSession(usePatternsDb(event), sessionId)
  }
  clearSessionCookie(event)
  return { ok: true }
})
