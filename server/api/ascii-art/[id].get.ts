import { getAsciiArtById } from '../../catalog/asciiArt'

// GET /api/ascii-art/:id
export default defineEventHandler(async (event) => {
  const db = usePatternsDb(event)
  await assertAsciiArtMigrated(db)

  const id = getRouterParam(event, 'id')
  const piece = id ? await getAsciiArtById(db, id) : null

  if (!piece) {
    throw createError({ statusCode: 404, statusMessage: 'ASCII art piece not found' })
  }
  return piece
})
