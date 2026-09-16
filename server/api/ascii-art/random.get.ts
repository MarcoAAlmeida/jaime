import { getRandomAsciiArt } from '../../catalog/asciiArt'

// GET /api/ascii-art/random?count=<n>
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertAsciiArtMigrated(db)

  const query = getQuery(event)
  const count = Number.parseInt(String(query.count ?? ''), 10)

  return getRandomAsciiArt(db, Number.isNaN(count) ? 1 : count)
})
