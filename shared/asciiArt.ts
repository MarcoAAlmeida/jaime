// ascii-overlay bounded context — shapes shared between the scraped
// gallery's read API (server/catalog/asciiArt) and the Composition
// Room panel that renders them.

export interface AsciiArtPiece {
  id: string
  title: string | null
  artist: string | null
  width: number
  height: number
  text: string
  sourceUrl: string
}
