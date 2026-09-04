import type { User } from './user'

// The single hard-coded operator identity (add-admin-console). Matched
// on GitHub login OR account email — two independent keys, so losing
// one (e.g. a GitHub rename) doesn't lock the operator out. No roles
// system; see design.md decision 3.
const OPERATOR_GITHUB_LOGIN = 'marcoaalmeida'
const OPERATOR_EMAIL = 'marcoalmeida.dev.br@gmail.com'

export function isOperator(
  user: Pick<User, 'email' | 'githubLogin'> | null | undefined,
): boolean {
  if (!user) return false
  return (
    user.githubLogin?.toLowerCase() === OPERATOR_GITHUB_LOGIN
    || user.email.toLowerCase() === OPERATOR_EMAIL
  )
}
