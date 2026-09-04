import type { User } from '#shared/user'
import type { H3Event } from 'h3'
import { isOperator } from '#shared/operator'
import { getCurrentUser } from './auth'

/**
 * The operator, or a 404 for anyone else (add-admin-console). 404 not
 * 403 — `/admin` must not acknowledge it exists to non-operators
 * (design.md decision 4). Every `/api/admin/*` handler calls this
 * first; the page middleware is UX, not the security boundary.
 */
export async function requireOperator(event: H3Event): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user || !isOperator(user)) {
    // Distinguish "operator locked out" from "route broke" in logs
    // without weakening the response.
    if (user) console.warn(`admin refused for ${user.id}`)
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  return user
}
