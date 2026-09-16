// ascii-overlay bounded context — Ascii Art read model. All D1 access
// for the scraped gallery lives here; the API routes stay thin. See
// openspec/changes/add-ascii-overlay/design.md.

import type { AsciiArtPiece } from '#shared/asciiArt'

export type { AsciiArtPiece } from '#shared/asciiArt'

const MAX_RANDOM_COUNT = 100

interface AsciiArtRow {
  id: string
  title: string | null
  artist: string | null
  width: number
  height: number
  text: string
  source_url: string
}

function rowToPiece(row: AsciiArtRow): AsciiArtPiece {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    width: row.width,
    height: row.height,
    text: row.text,
    sourceUrl: row.source_url,
  }
}

const SELECT_COLUMNS = 'id, title, artist, width, height, text, source_url'

/**
 * A random, unfiltered batch of up to `count` pieces (clamped to
 * [1, 100]) — no curation, no category filter (design.md: "Selection
 * Is Unfiltered And Random"). `ORDER BY RANDOM()` is fine at this
 * table's size (low tens of thousands of rows).
 */
export async function getRandomAsciiArt(db: D1Database, count: number): Promise<AsciiArtPiece[]> {
  const n = Math.min(MAX_RANDOM_COUNT, Math.max(1, Math.floor(count) || 1))
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM ascii_art ORDER BY RANDOM() LIMIT ?`)
    .bind(n)
    .all<AsciiArtRow>()
  return results.map(rowToPiece)
}

export async function getAsciiArtById(db: D1Database, id: string): Promise<AsciiArtPiece | null> {
  const row = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM ascii_art WHERE id = ?`)
    .bind(id)
    .first<AsciiArtRow>()
  return row ? rowToPiece(row) : null
}

/** True once the `ascii_art` table exists — used by the API to return a
 *  clean 503 instead of a raw error before the scrape has run. */
export async function isAsciiArtMigrated(db: D1Database): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ascii_art'`)
      .first<{ name: string }>()
    return !!row
  }
  catch {
    return false
  }
}
