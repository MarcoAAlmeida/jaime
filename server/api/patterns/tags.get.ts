import { listTags } from '../../catalog/patterns'

// GET /api/patterns/tags — the distinct tag list for the filter UI.
// A static segment, so it wins over /api/patterns/[id] for this path.
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertPatternsMigrated(db)
  return { tags: await listTags(db) }
})
