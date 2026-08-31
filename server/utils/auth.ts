import type { User } from '#shared/user'
import type { H3Event } from 'h3'
import { getSessionUser } from '../auth/sessions'
import { usePatternsDb } from './patternsDb'

const SESSION_COOKIE = 'jaime_session'
const SESSION_MAX_AGE = 90 * 24 * 60 * 60 // seconds

/** The current signed-in account for this request, or null. */
export async function getCurrentUser(event: H3Event): Promise<User | null> {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (!sessionId) return null
  return getSessionUser(usePatternsDb(event), sessionId)
}

/** Like getCurrentUser but throws 401 when there is no session. */
export async function requireUser(event: H3Event): Promise<User> {
  const user = await getCurrentUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in required' })
  }
  return user
}

export function setSessionCookie(event: H3Event, sessionId: string): void {
  setCookie(event, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    // `Secure` cookies aren't stored over plain http — off in local dev.
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export function readSessionCookie(event: H3Event): string | undefined {
  return getCookie(event, SESSION_COOKIE)
}
