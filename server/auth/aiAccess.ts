import type { User } from '#shared/user'

// `@jah` access resolution (add-admin-console). Effective access is the
// per-user `ai_access` grant OR the account's GitHub login being in the
// `AI_ACCESS_LOGINS` env list — combined here and nowhere else. Features
// that gate on `@jah` (Phase 1's add-jah-chat) call `hasAiAccess`, never
// `user.aiAccess` directly. See design.md decisions 1–2.

/** Parse the comma-separated `AI_ACCESS_LOGINS` var into a lowercased set. */
export function parseAllowlist(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** Whether this account currently has effective `@jah` access. */
export function hasAiAccess(user: User | null | undefined, allowlist: Set<string>): boolean {
  if (!user) return false
  if (user.aiAccess) return true
  const login = user.githubLogin?.toLowerCase()
  return login ? allowlist.has(login) : false
}

/**
 * Why an account has (or hasn't) access, for the /admin roster's label.
 * The per-user flag wins the label when both are true.
 */
export function effectiveAccess(
  user: Pick<User, 'aiAccess' | 'githubLogin'>,
  allowlist: Set<string>,
): 'flag' | 'allowlist' | 'none' {
  if (user.aiAccess) return 'flag'
  const login = user.githubLogin?.toLowerCase()
  if (login && allowlist.has(login)) return 'allowlist'
  return 'none'
}
