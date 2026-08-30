import { getPattern } from '../../catalog/patterns'

// GET /api/patterns/:id
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)

  const id = getRouterParam(event, 'id')
  const pattern = id ? await getPattern(db, id) : null

  if (!pattern) {
    throw createError({ statusCode: 404, statusMessage: 'Pattern not found' })
  }
  return pattern
})
