// embedAndUpsert against fake ai/vectorize — never a real binding, per the
// spec's "Search Never Runs Against A Real Index In Automated Tests". No
// D1 involved here by design (see the function's own doc comment).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embedAndUpsert, hashEmbeddedText, textToEmbed, toEmbeddingTrackingSql } from './knowledge-search.mjs'

function fakeAi() {
  const calls = []
  return {
    calls,
    async run(model, { text }) {
      calls.push({ model, text })
      return { shape: [text.length, 3], data: text.map((_, i) => [i, i + 1, i + 2]) }
    },
  }
}

function fakeVectorize() {
  const upserted = []
  const deleted = []
  return {
    upserted,
    deleted,
    async upsert(vectors) { upserted.push(...vectors); return { mutationId: 'x' } },
    async deleteByIds(ids) { deleted.push(...ids); return { mutationId: 'y' } },
  }
}

test('embeds every new chunk and upserts into vectorize, returning the hashes to persist', async () => {
  const chunkA = { id: 'a', title: 'a', text: 'text a' }
  const chunkB = { id: 'b', title: 'b', text: 'text b' }
  const ai = fakeAi()
  const vectorize = fakeVectorize()

  const { summary, updatedHashes, deletedIds } = await embedAndUpsert(ai, vectorize, new Map(), [chunkA, chunkB])

  assert.deepEqual(summary, { embedded: 2, skipped: 0, deleted: 0, truncated: 0 })
  assert.equal(vectorize.upserted.length, 2)
  assert.deepEqual(vectorize.upserted.map(v => v.id).sort(), ['a', 'b'])
  assert.deepEqual(deletedIds, [])
  assert.equal(updatedHashes.length, 2)
  assert.equal(updatedHashes.find(u => u.chunkId === 'a').textHash, hashEmbeddedText(textToEmbed(chunkA).text))
})

test('an already-embedded, unchanged chunk is skipped entirely — no call, no update', async () => {
  const chunkA = { id: 'a', title: 'a', text: 'text a' }
  const existingHash = hashEmbeddedText(textToEmbed(chunkA).text)
  const ai = fakeAi()
  const vectorize = fakeVectorize()

  const { summary, updatedHashes } = await embedAndUpsert(ai, vectorize, new Map([['a', existingHash]]), [chunkA])

  assert.deepEqual(summary, { embedded: 0, skipped: 1, deleted: 0, truncated: 0 })
  assert.equal(ai.calls.length, 0)
  assert.equal(vectorize.upserted.length, 0)
  assert.deepEqual(updatedHashes, [])
})

test('a changed chunk is re-embedded and its new hash returned', async () => {
  const chunkA = { id: 'a', title: 'a', text: 'new text' }
  const ai = fakeAi()
  const vectorize = fakeVectorize()

  const { summary, updatedHashes } = await embedAndUpsert(ai, vectorize, new Map([['a', 'stale-hash']]), [chunkA])

  assert.equal(summary.embedded, 1)
  assert.equal(updatedHashes[0].textHash, hashEmbeddedText(textToEmbed(chunkA).text))
})

test('a chunk removed from the corpus is deleted from vectorize and reported for deletion', async () => {
  const ai = fakeAi()
  const vectorize = fakeVectorize()

  const { summary, deletedIds } = await embedAndUpsert(ai, vectorize, new Map([['gone', 'whatever']]), [])

  assert.deepEqual(summary, { embedded: 0, skipped: 0, deleted: 1, truncated: 0 })
  assert.deepEqual(vectorize.deleted, ['gone'])
  assert.deepEqual(deletedIds, ['gone'])
})

test('truncated chunks are counted in the summary', async () => {
  const longChunk = { id: 'long', title: 'long', text: 'x'.repeat(3000) }
  const { summary } = await embedAndUpsert(fakeAi(), fakeVectorize(), new Map(), [longChunk])
  assert.equal(summary.truncated, 1)
})

test('batches embedding calls so no single ai.run() call gets an unbounded array', async () => {
  const chunks = Array.from({ length: 250 }, (_, i) => ({ id: `c${i}`, title: `c${i}`, text: `text ${i}` }))
  const ai = fakeAi()
  const vectorize = fakeVectorize()

  const { summary } = await embedAndUpsert(ai, vectorize, new Map(), chunks)

  assert.equal(summary.embedded, 250)
  assert.ok(ai.calls.length > 1, 'expected more than one batch')
  assert.ok(ai.calls.every(c => c.text.length <= 100))
  assert.equal(vectorize.upserted.length, 250)
})

test('toEmbeddingTrackingSql() upserts each hash and prunes deleted ids', () => {
  const sql = toEmbeddingTrackingSql([{ chunkId: 'a', textHash: 'hash-a' }], ['gone'], '2026-01-01T00:00:00.000Z')
  assert.ok(sql.includes("INSERT INTO knowledge_chunk_embeddings (chunk_id, text_hash, embedded_at) VALUES ('a', 'hash-a', '2026-01-01T00:00:00.000Z')"))
  assert.ok(sql.includes('ON CONFLICT(chunk_id) DO UPDATE'))
  assert.ok(sql.includes("DELETE FROM knowledge_chunk_embeddings WHERE chunk_id IN ('gone')"))
})

test('toEmbeddingTrackingSql() with nothing to delete omits the DELETE entirely', () => {
  const sql = toEmbeddingTrackingSql([{ chunkId: 'a', textHash: 'h' }], [], '2026-01-01T00:00:00.000Z')
  assert.ok(!sql.includes('DELETE FROM'))
})

test('toEmbeddingTrackingSql() with nothing at all is still valid (a comment-only no-op)', () => {
  const sql = toEmbeddingTrackingSql([], [], '2026-01-01T00:00:00.000Z')
  assert.ok(!sql.includes('INSERT'))
  assert.ok(!sql.includes('DELETE'))
})
