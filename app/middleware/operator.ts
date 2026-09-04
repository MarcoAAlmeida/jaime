import { isOperator } from '#shared/operator'

// Route middleware for /admin (add-admin-console). Renders the standard
// not-found page for anyone who isn't the operator — signed in or not —
// so the surface never acknowledges it exists (no sign-in redirect
// either). The real gate is server-side on each /api/admin/* handler;
// this is UX. Auth state is hydrated by app/plugins/auth.ts first.
export default defineNuxtRouteMiddleware(() => {
  const { user } = useAuth()
  if (!isOperator(user.value)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
})
