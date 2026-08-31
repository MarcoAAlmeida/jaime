import { createSession } from '../../auth/sessions'
import { consumeToken } from '../../auth/tokens'
import { confirmUser } from '../../auth/users'

// GET /auth/callback?token=<raw>&next=<path>
// Burns the token, confirms the account on first use, starts a session
// (cookie set on this redirect), and lands the user in the app.
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  const userId = token ? await consumeToken(db, token) : null
  if (!userId) {
    return sendRedirect(event, '/signup?error=link', 302)
  }

  await confirmUser(db, userId)
  const sessionId = await createSession(db, userId)
  setSessionCookie(event, sessionId)

  const next = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/'
  return sendRedirect(event, next, 302)
})
