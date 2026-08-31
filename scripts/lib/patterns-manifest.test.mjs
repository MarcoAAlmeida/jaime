// Run with `node --test scripts/lib/`. Plain Node test — the parser uses
// node:fs and can't run in the workers vitest pool.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { ManifestError, readManifest, toReconcileSql, validateManifest } from './patterns-manifest.mjs'

let dir
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'manifest-test-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function write(name, content) {
  writeFileSync(join(dir, name), content)
}

const OK = `---
title: Four on the floor
tags: [drums, house]
source_url: https://strudel.cc/x
---

\`\`\`strudel
s("bd*4")
\`\`\`
`

describe('readManifest', () => {
  test('parses a well-formed file', () => {
    write('seed-four.md', OK)
    write('README.md', '# ignored')
    const entries = readManifest(dir)
    assert.equal(entries.length, 1)
    assert.deepEqual(entries[0], {
      id: 'seed-four',
      title: 'Four on the floor',
      code: 's("bd*4")',
      tags: ['drums', 'house'],
      sourceUrl: 'https://strudel.cc/x',
      sourceAuthor: null,
      createdAt: entries[0].createdAt,
    })
    assert.match(entries[0].createdAt, /^\d{4}-\d{2}-\d{2}T/)
  })

  test('coerces numeric tags to strings', () => {
    write('acid.md', OK.replace('[drums, house]', '[acid, 303]'))
    assert.deepEqual(readManifest(dir)[0].tags, ['acid', '303'])
  })

  test('rejects an entry with no source_url', () => {
    write('nosrc.md', OK.replace('source_url: https://strudel.cc/x\n', ''))
    assert.throws(() => readManifest(dir), (err) => {
      assert.ok(err instanceof ManifestError)
      assert.ok(err.problems.some(p => p.includes('source_url')))
      return true
    })
  })

  test('rejects an entry with no code fence', () => {
    write('nocode.md', OK.replace(/```strudel[\s\S]*```/, 'just prose'))
    assert.throws(() => readManifest(dir), /fenced code block/)
  })

  test('rejects malformed frontmatter', () => {
    write('bad.md', 'no frontmatter here\n\n```strudel\ns("bd")\n```\n')
    assert.throws(() => readManifest(dir), /frontmatter/)
  })

  test('reports every problem at once', () => {
    write('a.md', 'garbage')
    write('b.md', OK.replace('source_url: https://strudel.cc/x\n', ''))
    try {
      readManifest(dir)
      assert.fail('should have thrown')
    }
    catch (err) {
      assert.ok(err instanceof ManifestError)
      assert.equal(err.problems.length, 2)
    }
  })

  test('returns entries sorted by id', () => {
    write('zzz.md', OK)
    write('aaa.md', OK)
    assert.deepEqual(readManifest(dir).map(e => e.id), ['aaa', 'zzz'])
  })
})

describe('validateManifest', () => {
  test('flags duplicate ids', () => {
    assert.throws(
      () => validateManifest([{ id: 'x' }, { id: 'x' }]),
      /duplicate pattern id 'x'/,
    )
  })
})

describe('toReconcileSql', () => {
  const entries = [
    { id: 'p1', title: "O'Brien", code: 's("bd")', tags: ['a', 'b'], sourceUrl: 'u', sourceAuthor: null, createdAt: '2026-09-01T00:00:00.000Z' },
    { id: 'p2', title: 'Two', code: 's("sd")', tags: [], sourceUrl: 'u2', sourceAuthor: 'Ann', createdAt: '2026-09-01T00:00:01.000Z' },
  ]

  test('escapes single quotes in values', () => {
    const sql = toReconcileSql(entries)
    assert.ok(sql.includes("'O''Brien'"))
  })

  test('upserts every entry and prunes the rest, scoped to curated', () => {
    const sql = toReconcileSql(entries)
    assert.ok(sql.includes('ON CONFLICT(id) DO UPDATE'))
    assert.ok(sql.includes("id NOT IN ('p1', 'p2')"))
    assert.ok(sql.includes("DELETE FROM patterns WHERE origin='curated'"))
    assert.ok(!sql.includes("origin='user'"))
  })

  test('is stable — same entries produce identical SQL', () => {
    assert.equal(toReconcileSql(entries), toReconcileSql(entries))
  })

  test('handles an empty manifest without invalid SQL', () => {
    const sql = toReconcileSql([])
    assert.ok(sql.includes("id NOT IN ('')"))
    assert.ok(!sql.includes('INSERT INTO patterns'))
  })
})
