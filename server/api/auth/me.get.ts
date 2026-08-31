// GET /api/auth/me → { user } | { user: null }
export default defineEventHandler(async (event) => {
  return { user: await getCurrentUser(event) }
})
