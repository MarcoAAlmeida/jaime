// The account shape shared between the auth server and the client.

export interface User {
  id: string
  email: string
  displayName: string
  status: 'pending' | 'confirmed'
  createdAt: string
  /** Profile picture (GitHub avatar). Absent for accounts with none. */
  avatarUrl?: string
  /** GitHub username, when the account signed in with GitHub. */
  githubLogin?: string
  /**
   * The per-user `@jah` access grant. Effective access is this OR the
   * account's GitHub login being in the `AI_ACCESS_LOGINS` env list —
   * use `hasAiAccess()` (server/auth/aiAccess.ts), never this alone.
   */
  aiAccess: boolean
}
