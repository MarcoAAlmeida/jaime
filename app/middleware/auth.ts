// Route middleware: bounce anonymous visitors to sign-in, remembering
// where they were headed. Auth state is hydrated by app/plugins/auth.ts
// before middleware runs.
export default defineNuxtRouteMiddleware((to) => {
  const { isSignedIn } = useAuth()
  if (!isSignedIn.value) {
    return navigateTo(`/signup?next=${encodeURIComponent(to.fullPath)}`)
  }
})
