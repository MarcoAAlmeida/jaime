// Catalog bounded context — Knowledge chunk read model (add-knowledge-store).
// All D1 access for the Strudel documentation corpus lives here, mirroring
// patterns.ts's own split (reconcile logic in scripts/lib/knowledge-store.mjs,
// reads here). Nothing calls findChunkByName yet — this exists as the seam
// add-jah-knowledge-retrieval will use. See design.md decision 4.

export interface KnowledgeChunk {
  id: string
  kind: 'function' | 'concept' | 'example'
  title: string
  category: string
  tags: string[]
  text: string
  sourceUrl: string | null
  license: string
  version: string
  synonyms: string[]
  params: Array<{ name: string, types: string[], description: string | null }>
  examples: string[]
}

interface ChunkRow {
  id: string
  kind: string
  title: string
  category: string
  text: string
  source_url: string | null
  license: string
  version: string
}

function rowToChunk(
  row: ChunkRow,
  tags: string[],
  synonyms: string[],
  params: Array<{ name: string, types: string[], description: string | null }>,
  examples: string[],
): KnowledgeChunk {
  return {
    id: row.id,
    kind: row.kind as KnowledgeChunk['kind'],
    title: row.title,
    category: row.category,
    tags,
    text: row.text,
    sourceUrl: row.source_url,
    license: row.license,
    version: row.version,
    synonyms,
    params,
    examples,
  }
}

/**
 * Resolves `name` against a chunk's id, or against any of a function
 * chunk's synonyms, and returns its full content — or `null` when
 * nothing matches.
 */
export async function findChunkByName(db: D1Database, name: string): Promise<KnowledgeChunk | null> {
  const row = await db
    .prepare(
      `SELECT id, kind, title, category, text, source_url, license, version
       FROM knowledge_chunks
       WHERE id = ?1
          OR id IN (SELECT chunk_id FROM knowledge_chunk_synonyms WHERE synonym = ?1)`,
    )
    .bind(name)
    .first<ChunkRow>()
  if (!row) return null

  const [tags, synonyms, params, examples] = await Promise.all([
    db.prepare('SELECT tag FROM knowledge_chunk_tags WHERE chunk_id = ? ORDER BY tag')
      .bind(row.id).all<{ tag: string }>(),
    db.prepare('SELECT synonym FROM knowledge_chunk_synonyms WHERE chunk_id = ? ORDER BY synonym')
      .bind(row.id).all<{ synonym: string }>(),
    db.prepare('SELECT name, types, description FROM knowledge_chunk_params WHERE chunk_id = ? ORDER BY position')
      .bind(row.id).all<{ name: string, types: string | null, description: string | null }>(),
    db.prepare('SELECT code FROM knowledge_chunk_examples WHERE chunk_id = ? ORDER BY position')
      .bind(row.id).all<{ code: string }>(),
  ])

  return rowToChunk(
    row,
    tags.results.map(r => r.tag),
    synonyms.results.map(r => r.synonym),
    params.results.map(p => ({ name: p.name, types: p.types ? JSON.parse(p.types) : [], description: p.description })),
    examples.results.map(e => e.code),
  )
}
