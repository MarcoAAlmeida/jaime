// Semantic search over the knowledge corpus (add-knowledge-search): what
// text gets embedded, change detection so an unchanged chunk is never
// re-embedded, and the actual embed/upsert/prune against Workers AI +
// Vectorize. See design.md decisions 3-4. Pure functions here have no
// I/O and are fully offline-testable; embedAndUpsert is the one function
// that actually calls the real bindings.

import { createHash } from 'node:crypto'
import { sq } from './patterns-manifest.mjs'

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'
// ~512 tokens for English text is roughly 2,000 characters — a
// conservative heuristic, not a token-exact count (design.md decision 4).
const MAX_EMBED_CHARS = 2000

/**
 * The text actually embedded for a chunk: its title anchors the
 * embedding even when the description is thin or empty, truncated to a
 * safe budget. Truncation is reported, not silent.
 *
 * @param {{ title: string, text: string }} chunk
 * @returns {{ text: string, truncated: boolean }}
 */
export function textToEmbed(chunk) {
  const full = `${chunk.title}: ${chunk.text ?? ''}`
  if (full.length <= MAX_EMBED_CHARS) return { text: full, truncated: false }
  return { text: full.slice(0, MAX_EMBED_CHARS), truncated: true }
}

/** Stable, short hash of the exact text embedded — used for change detection. */
export function hashEmbeddedText(text) {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * Decides what needs (re-)embedding and what needs deleting, without
 * calling anything — a pure diff between the corpus and what's already
 * recorded as embedded.
 *
 * @param {object[]} chunks the corpus's chunks
 * @param {Map<string,string>} existingHashes chunk_id -> text_hash, from knowledge_chunk_embeddings
 * @returns {{ toEmbed: object[], toDelete: string[] }}
 */
export function planEmbeddingWork(chunks, existingHashes) {
  const toEmbed = []
  const seenIds = new Set()

  for (const chunk of chunks) {
    seenIds.add(chunk.id)
    const { text } = textToEmbed(chunk)
    const hash = hashEmbeddedText(text)
    if (existingHashes.get(chunk.id) !== hash) toEmbed.push(chunk)
  }

  const toDelete = [...existingHashes.keys()].filter(id => !seenIds.has(id))

  return { toEmbed, toDelete }
}

// Workers AI has no documented per-call text-array limit for this model;
// Vectorize's own upsert batch limit is 1,000 vectors per call (Workers
// binding). One conservative batch size covers both calls per batch.
const BATCH_SIZE = 100

function chunksOf(array, size) {
  const batches = []
  for (let i = 0; i < array.length; i += size) batches.push(array.slice(i, i + size))
  return batches
}

/**
 * Embeds every new/changed chunk and upserts into Vectorize — the
 * network-calling half of the reconcile step's embedding phase
 * (design.md decisions 3-4). Deliberately has NO D1 access of its own:
 * every other Node script in this repo reads/writes PATTERNS_DB through
 * `wrangler d1 execute` subprocess calls (never a JS binding), so this
 * takes the current hashes as plain data and returns plain data for the
 * caller (`sync-knowledge.mjs`) to persist the same way — avoiding a new,
 * separate local-vs-remote binding path that could silently write to the
 * wrong database.
 *
 * @param {Ai} ai
 * @param {Vectorize} vectorize
 * @param {Map<string,string>} existingHashes chunk_id -> text_hash, from knowledge_chunk_embeddings
 * @param {object[]} chunks the corpus's chunks
 * @returns {Promise<{
 *   summary: { embedded: number, skipped: number, deleted: number, truncated: number },
 *   updatedHashes: Array<{ chunkId: string, textHash: string }>,
 *   deletedIds: string[],
 * }>}
 */
export async function embedAndUpsert(ai, vectorize, existingHashes, chunks) {
  const { toEmbed, toDelete } = planEmbeddingWork(chunks, existingHashes)

  let truncated = 0
  const updatedHashes = []

  for (const batch of chunksOf(toEmbed, BATCH_SIZE)) {
    const prepared = batch.map(chunk => textToEmbed(chunk))
    truncated += prepared.filter(p => p.truncated).length

    const { data } = await ai.run(EMBEDDING_MODEL, { text: prepared.map(p => p.text) })

    await vectorize.upsert(batch.map((chunk, i) => ({ id: chunk.id, values: data[i] })))

    for (const [i, chunk] of batch.entries()) updatedHashes.push({ chunkId: chunk.id, textHash: hashEmbeddedText(prepared[i].text) })
  }

  for (const batch of chunksOf(toDelete, BATCH_SIZE)) await vectorize.deleteByIds(batch)

  return {
    summary: { embedded: toEmbed.length, skipped: chunks.length - toEmbed.length, deleted: toDelete.length, truncated },
    updatedHashes,
    deletedIds: toDelete,
  }
}

/**
 * SQL to persist embedAndUpsert's result into `knowledge_chunk_embeddings`
 * — the same `wrangler d1 execute --file` mechanism
 * `scripts/lib/knowledge-store.mjs` already uses for the chunk tables.
 *
 * @param {Array<{ chunkId: string, textHash: string }>} updatedHashes
 * @param {string[]} deletedIds
 * @param {string} embeddedAt ISO-8601 timestamp, one per reconcile run
 */
export function toEmbeddingTrackingSql(updatedHashes, deletedIds, embeddedAt) {
  const lines = ['-- generated by scripts/lib/knowledge-search.mjs — do not edit by hand']

  for (const { chunkId, textHash } of updatedHashes) {
    lines.push(
      `INSERT INTO knowledge_chunk_embeddings (chunk_id, text_hash, embedded_at) VALUES (${sq(chunkId)}, ${sq(textHash)}, ${sq(embeddedAt)}) `
      + 'ON CONFLICT(chunk_id) DO UPDATE SET text_hash=excluded.text_hash, embedded_at=excluded.embedded_at;',
    )
  }
  if (deletedIds.length > 0) {
    lines.push(`DELETE FROM knowledge_chunk_embeddings WHERE chunk_id IN (${deletedIds.map(sq).join(', ')});`)
  }

  return `${lines.join('\n')}\n`
}
