// The account shape shared between the auth server and the client.

export interface User {
  id: string
  email: string
  displayName: string
  status: 'pending' | 'confirmed'
  createdAt: string
  /** Profile picture (GitHub avatar). Absent for accounts with none. */
  avatarUrl?: string
}
