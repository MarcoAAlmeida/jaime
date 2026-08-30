// Catalog bounded context — Pattern read model. All D1 access for the
// pattern library lives here; the API routes stay thin. See
// openspec/changes/add-pattern-library/design.md.

import type { Pattern, PatternListResult } from '#shared/catalog'

export type { Pattern, PatternListResult } from '#shared/catalog'

export interface ListPatternsQuery {
  /** Patterns must carry every tag listed here (AND). Empty = no tag filter. */
  tags?: string[]
  /** Free-text query, matched case-insensitively against title and tags. */
  q?: string
  /** 1-based page number. */
  page?: number
  /** Requested page size; clamped to [1, MAX_LIMIT], default DEFAULT_LIMIT. */
  limit?: number
}

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 60

interface PatternRow {
  id: string
  title: string
  code: string
  source_url: string
  source_author: string | null
  created_at: string
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT
  return Math.min(Math.floor(limit), MAX_LIMIT)
}

function clampPage(page: number | undefined): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1
  return Math.floor(page)
}

/**
 * Builds the shared `WHERE` clause (and its bind params) for the tag
 * filter + text search. Used by both the count and the page query so
 * they always agree.
 */
function buildFilter(tags: string[], q: string): { sql: string, params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []

  if (tags.length > 0) {
    const placeholders = tags.map(() => '?').join(', ')
    clauses.push(
      `p.id IN (
         SELECT pattern_id FROM pattern_tags
         WHERE tag IN (${placeholders})
         GROUP BY pattern_id
         HAVING count(DISTINCT tag) = ?
       )`,
    )
    params.push(...tags, tags.length)
  }

  if (q) {
    const like = `%${q.toLowerCase()}%`
    clauses.push(
      `(lower(p.title) LIKE ?
        OR p.id IN (SELECT pattern_id FROM pattern_tags WHERE lower(tag) LIKE ?))`,
    )
    params.push(like, like)
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

async function tagsFor(db: D1Database, ids: string[]): Promise<Map<string, string[]>> {
  const byId = new Map<string, string[]>()
  for (const id of ids) byId.set(id, [])
  if (ids.length === 0) return byId

  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await db
    .prepare(`SELECT pattern_id, tag FROM pattern_tags WHERE pattern_id IN (${placeholders}) ORDER BY tag`)
    .bind(...ids)
    .all<{ pattern_id: string, tag: string }>()

  for (const row of results) byId.get(row.pattern_id)?.push(row.tag)
  return byId
}

function rowToPattern(row: PatternRow, tags: string[]): Pattern {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    tags,
    source: { url: row.source_url, author: row.source_author },
    createdAt: row.created_at,
  }
}

export async function listPatterns(
  db: D1Database,
  query: ListPatternsQuery = {},
): Promise<PatternListResult> {
  const tags = (query.tags ?? []).map(t => t.trim()).filter(Boolean)
  const q = (query.q ?? '').trim()
  const page = clampPage(query.page)
  const pageSize = clampLimit(query.limit)
  const offset = (page - 1) * pageSize

  const filter = buildFilter(tags, q)

  const totalRow = await db
    .prepare(`SELECT count(*) AS n FROM patterns p ${filter.sql}`)
    .bind(...filter.params)
    .first<{ n: number }>()
  const total = totalRow?.n ?? 0

  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.code, p.source_url, p.source_author, p.created_at
       FROM patterns p
       ${filter.sql}
       ORDER BY p.created_at DESC, p.id
       LIMIT ? OFFSET ?`,
    )
    .bind(...filter.params, pageSize, offset)
    .all<PatternRow>()

  const tagMap = await tagsFor(db, results.map(r => r.id))
  const patterns = results.map(r => rowToPattern(r, tagMap.get(r.id) ?? []))

  return { patterns, page, pageSize, total }
}

export async function getPattern(db: D1Database, id: string): Promise<Pattern | null> {
  const row = await db
    .prepare(
      `SELECT id, title, code, source_url, source_author, created_at
       FROM patterns WHERE id = ?`,
    )
    .bind(id)
    .first<PatternRow>()
  if (!row) return null

  const { results } = await db
    .prepare('SELECT tag FROM pattern_tags WHERE pattern_id = ? ORDER BY tag')
    .bind(id)
    .all<{ tag: string }>()

  return rowToPattern(row, results.map(r => r.tag))
}

export async function listTags(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT DISTINCT tag FROM pattern_tags ORDER BY tag')
    .all<{ tag: string }>()
  return results.map(r => r.tag)
}

/** True once the `patterns` table exists — used by the API to return a
 *  clean 503 instead of a raw error when migrations haven't run. */
export async function isMigrated(db: D1Database): Promise<boolean> {
  try {
    const row = await db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'patterns'`)
      .first<{ name: string }>()
    return !!row
  }
  catch {
    return false
  }
}
