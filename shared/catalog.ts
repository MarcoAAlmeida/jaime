// Catalog bounded context — shapes shared between the pattern-library
// API (server/catalog) and the client that renders it.

export interface Pattern {
  id: string
  title: string
  code: string
  tags: string[]
  source: { url: string, author: string | null }
  createdAt: string
}

export interface PatternListResult {
  patterns: Pattern[]
  page: number
  pageSize: number
  total: number
}
