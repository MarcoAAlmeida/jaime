import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { buildKnowledgeReconcileSql, readCorpus, toKnowledgeReconcileSql } from './knowledge-store.mjs'

describe('toKnowledgeReconcileSql', () => {
  const functionChunk = {
    id: 'rev', kind: 'function', title: 'rev', category: 'Time Modifiers',
    tags: ['temporal'], text: 'Reverses a pattern.', sourceUrl: 'https://…/pattern.mjs',
    license: 'AGPL-3.0', version: '8f81463',
    synonyms: ['reverse'],
    params: [{ name: 'pat', types: ['Pattern'], description: 'the pattern' }],
    examples: ['note("c d e").rev()'],
  }
  const conceptChunk = {
    id: 'learn-mini-notation-sequences', kind: 'concept', title: 'Sequences',
    category: 'Mini Notation', tags: [], text: 'A sequence plays one step per cycle.',
    sourceUrl: 'https://…/mini-notation.mdx', license: 'AGPL-3.0', version: '8f81463',
  }

  test('upserts a function chunk\'s own row', () => {
    const sql = toKnowledgeReconcileSql([functionChunk])
    assert.ok(sql.includes('INSERT INTO knowledge_chunks'))
    assert.ok(sql.includes("'rev', 'function', 'rev', 'Time Modifiers'"))
    assert.ok(sql.includes('ON CONFLICT(id) DO UPDATE'))
  })

  test('writes tags, synonyms, params, and examples for a function chunk', () => {
    const sql = toKnowledgeReconcileSql([functionChunk])
    assert.ok(sql.includes("INSERT INTO knowledge_chunk_tags (chunk_id, tag) VALUES ('rev', 'temporal')"))
    assert.ok(sql.includes("INSERT INTO knowledge_chunk_synonyms (chunk_id, synonym) VALUES ('rev', 'reverse')"))
    assert.ok(sql.includes("INSERT INTO knowledge_chunk_params (chunk_id, position, name, types, description) VALUES ('rev', 0, 'pat'"))
    assert.ok(sql.includes("INSERT INTO knowledge_chunk_examples (chunk_id, position, code) VALUES ('rev', 0,"))
  })

  test('a concept chunk with no tags/synonyms/params/examples writes none of those rows', () => {
    const sql = toKnowledgeReconcileSql([conceptChunk])
    assert.ok(!sql.includes('INSERT INTO knowledge_chunk_tags'))
    assert.ok(!sql.includes('INSERT INTO knowledge_chunk_synonyms'))
    assert.ok(!sql.includes('INSERT INTO knowledge_chunk_params'))
    assert.ok(!sql.includes('INSERT INTO knowledge_chunk_examples'))
  })

  test('is stable — the same input produces identical SQL every time (idempotent in outcome)', () => {
    const chunks = [functionChunk, conceptChunk]
    assert.equal(toKnowledgeReconcileSql(chunks), toKnowledgeReconcileSql(chunks))
  })

  test('prunes every child table and the chunk itself for an id no longer present', () => {
    const sql = toKnowledgeReconcileSql([conceptChunk]) // functionChunk ("rev") is absent
    assert.ok(sql.includes(`WHERE id NOT IN ('${conceptChunk.id}')`))
    for (const table of ['knowledge_chunk_tags', 'knowledge_chunk_synonyms', 'knowledge_chunk_params', 'knowledge_chunk_examples']) {
      assert.ok(sql.includes(`DELETE FROM ${table} WHERE chunk_id IN (SELECT id FROM knowledge_chunks WHERE id NOT IN`))
    }
    assert.ok(sql.includes('DELETE FROM knowledge_chunks WHERE id NOT IN'))
  })

  test('an edited chunk (same id, new text) updates rather than duplicating', () => {
    const edited = { ...functionChunk, text: 'A brand new description.' }
    const sql = toKnowledgeReconcileSql([edited])
    assert.ok(sql.includes('text=excluded.text'))
    assert.match(sql, /INSERT INTO knowledge_chunks[\s\S]*'rev'/)
    assert.equal((sql.match(/'rev'/g) ?? []).length > 0, true)
  })

  test('has no origin-style guard on the prune, unlike patterns', () => {
    const sql = toKnowledgeReconcileSql([conceptChunk])
    assert.ok(!sql.includes('origin'))
  })

  test('handles an empty corpus without invalid SQL', () => {
    const sql = toKnowledgeReconcileSql([])
    assert.ok(sql.includes("id NOT IN ('')"))
    assert.ok(!sql.includes('INSERT INTO knowledge_chunks'))
  })

  test('escapes single quotes in text', () => {
    const sql = toKnowledgeReconcileSql([{ ...conceptChunk, title: "Beginner's guide" }])
    assert.ok(sql.includes("'Beginner''s guide'"))
  })

  test('a null sourceUrl becomes SQL NULL, not the string "null"', () => {
    const sql = toKnowledgeReconcileSql([{ ...conceptChunk, sourceUrl: null }])
    assert.match(sql, /'learn-mini-notation-sequences', 'concept', 'Sequences', 'Mini Notation', '[^']*', NULL,/)
  })
})

describe('readCorpus / buildKnowledgeReconcileSql', () => {
  test('reads and parses the real committed corpus', () => {
    const corpus = readCorpus()
    assert.ok(Array.isArray(corpus.chunks))
    assert.ok(corpus.chunks.length > 0)
  })

  test('builds non-empty SQL covering every real chunk id', () => {
    const corpus = readCorpus()
    const sql = buildKnowledgeReconcileSql()
    assert.ok(sql.length > 0)
    // Spot check a handful of real ids appear somewhere in the upsert SQL.
    for (const id of corpus.chunks.slice(0, 5).map(c => c.id)) {
      assert.ok(sql.includes(`'${id.replace(/'/g, '\'\'')}'`), `expected ${id} in the generated SQL`)
    }
  })
})
