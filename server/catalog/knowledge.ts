// Catalog bounded context — Knowledge chunk read model
// (add-knowledge-store, add-knowledge-search). All D1/AI/Vectorize access
// for the Strudel documentation corpus lives here, mirroring patterns.ts's
// own split (reconcile logic in scripts/lib/knowledge-store.mjs /
// knowledge-search.mjs, reads here). Nothing calls findChunkByName or
// searchChunks yet — these exist as the seam add-jah-knowledge-retrieval
// will use.

// Must match scripts/lib/knowledge-search.mjs's EMBEDDING_MODEL — a
// query embedded with a different model than the corpus lives in
// incompatible vector spaces, so similarity scores would be meaningless.
// Duplicated rather than shared because this runs in the Worker at
// request time while that one runs as a Node CLI script; there's no
// existing precedent in this repo for a module crossing that boundary.
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'

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

/**
 * Finds chunks by the meaning of `query`, ranked by Vectorize's own
 * relevance score, each resolved to its full content via
 * `findChunkByName`. Returns `[]` rather than throwing when nothing
 * matches or the index is empty.
 */
export async function searchChunks(ai: Ai, vectorize: VectorizeIndex, db: D1Database, query: string, topK = 5): Promise<KnowledgeChunk[]> {
  const { data } = await ai.run(EMBEDDING_MODEL, { text: [query] }) as { data: number[][] }
  const { matches } = await vectorize.query(data[0]!, { topK })
  const chunks = await Promise.all(matches.map(m => findChunkByName(db, m.id)))
  return chunks.filter((c): c is KnowledgeChunk => c !== null)
}
