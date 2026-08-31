import type { User } from '#shared/user'

// Hydrate the signed-in account during SSR (forwarding the request's
// cookie) so the server render — and the gated docs page — knows who
// the request is from. The client picks the state up from the payload;
// no client-side fetch on load.
export default defineNuxtPlugin(async () => {
  if (!import.meta.server) return
  const user = useState<User | null>('auth-user', () => null)
  const { user: fetched } = await useRequestFetch()('/api/auth/me').catch(() => ({ user: null as User | null }))
  user.value = fetched
})
