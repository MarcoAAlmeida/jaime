import { listPatterns } from '../../catalog/patterns'

// GET /api/patterns?tag=<t>&tag=<t2>&q=<text>&page=<n>&limit=<n>
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)

  const query = getQuery(event)

  const tagParam = query.tag
  const tags = (Array.isArray(tagParam) ? tagParam : tagParam ? [tagParam] : [])
    .map(String)

  const page = Number.parseInt(String(query.page ?? ''), 10)
  const limit = Number.parseInt(String(query.limit ?? ''), 10)

  return listPatterns(db, {
    tags,
    q: query.q ? String(query.q) : undefined,
    page: Number.isNaN(page) ? undefined : page,
    limit: Number.isNaN(limit) ? undefined : limit,
  })
})
