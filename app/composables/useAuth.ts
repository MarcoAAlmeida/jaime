import type { User } from '#shared/user'

// The signed-in account for this browser, or null. Hydrated once
// server-side by app/plugins/auth.server.ts; kept in sync client-side
// by refresh() after a sign-in / sign-out.
export function useAuth() {
  const user = useState<User | null>('auth-user', () => null)
  const isSignedIn = computed(() => user.value !== null)

  async function refresh() {
    try {
      const { user: fetched } = await $fetch<{ user: User | null }>('/api/auth/me')
      user.value = fetched
    }
    catch {
      user.value = null
    }
  }

  /** Request a magic-link email. Returns `devLink` in local dev / e2e. */
  async function requestLink(email: string, displayName?: string, next?: string) {
    return $fetch<{ ok: true, devLink?: string }>('/api/auth/request', {
      method: 'POST',
      body: { email, displayName, next },
    })
  }

  async function updateDisplayName(displayName: string) {
    const { user: updated } = await $fetch<{ user: User }>('/api/auth/me', {
      method: 'PATCH',
      body: { displayName },
    })
    user.value = updated
    return updated
  }

  async function signOut() {
    await $fetch('/api/auth/signout', { method: 'POST' })
    user.value = null
    await navigateTo('/')
  }

  async function deleteAccount() {
    await $fetch('/api/auth/account', { method: 'DELETE' })
    user.value = null
    await navigateTo('/')
  }

  return {
    user,
    isSignedIn,
    refresh,
    requestLink,
    updateDisplayName,
    signOut,
    deleteAccount,
  }
}
