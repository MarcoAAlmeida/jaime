// Run with `node --test scripts/lib/`. Plain Node test — the parser uses
// node:fs and can't run in the workers vitest pool.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { fenceFor, ManifestError, normalizeCode, readManifest, toReconcileSql, validateManifest } from './patterns-manifest.mjs'

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
      favorite: false,
    })
    assert.match(entries[0].createdAt, /^\d{4}-\d{2}-\d{2}T/)
  })

  test('parses favorite: true', () => {
    write('starter.md', OK.replace('source_url: https://strudel.cc/x', 'source_url: https://strudel.cc/x\nfavorite: true'))
    assert.equal(readManifest(dir)[0].favorite, true)
  })

  test('rejects a non-boolean favorite', () => {
    write('bad-favorite.md', OK.replace('source_url: https://strudel.cc/x', 'source_url: https://strudel.cc/x\nfavorite: 1'))
    assert.throws(() => readManifest(dir), (err) => {
      assert.ok(err instanceof ManifestError)
      assert.ok(err.problems.some(p => p.includes('favorite')))
      return true
    })
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

describe('code fidelity (add-pattern-ingestion-skill)', () => {
  const wrap = (fence, code, info = 'strudel') => `---
title: T
source_url: https://example.com/x
---

${fence}${info}
${code}
${fence}
`

  test('code containing a line of ``` is read back whole from a longer fence', () => {
    const code = 'const t = `\n```\ninside\n```\n`\ns("bd*4")'
    write('ticks.md', wrap('````', code))
    assert.equal(readManifest(dir)[0].code, code)
  })

  test('fenceFor is longer than any backtick run, minimum three', () => {
    assert.equal(fenceFor('s("bd")'), '```')
    assert.equal(fenceFor('a `b` c'), '```')
    assert.equal(fenceFor('x\n```\ny'), '````')
    assert.equal(fenceFor('x ```` y'), '`````')
  })

  test('keeps comments, blank lines and indentation, including on the first line', () => {
    const code = '  // "Title"\n  // @by someone\n\n$: s("bd*4")\n    .gain(.5)\n'
    write('fmt.md', wrap('```', code))
    assert.equal(readManifest(dir)[0].code, code.trimEnd())
  })

  test('normalises CRLF to LF and trims only edge blank lines and trailing space', () => {
    assert.equal(normalizeCode('\r\n\r\n  a\r\nb  \r\n\r\n'), '  a\nb')
    write('crlf.md', wrap('```', 'a\nb').replace(/\n/g, '\r\n'))
    assert.equal(readManifest(dir)[0].code, 'a\nb')
  })

  test('a closing fence must be at least as long as the opening one', () => {
    write('short.md', `---
title: T
source_url: https://example.com/x
---

\`\`\`\`strudel
a
\`\`\`
b
\`\`\`\`
`)
    assert.equal(readManifest(dir)[0].code, 'a\n```\nb')
  })

  test('skips a fenced block of another language before the code', () => {
    write('other.md', `---
title: T
source_url: https://example.com/x
---

\`\`\`text
not the pattern
\`\`\`

\`\`\`strudel
s("bd")
\`\`\`
`)
    assert.equal(readManifest(dir)[0].code, 's("bd")')
  })

  test('an unclosed fence yields no code (and is reported)', () => {
    write('open.md', '---\ntitle: T\nsource_url: https://example.com/x\n---\n\n```strudel\ns("bd")\n')
    assert.throws(() => readManifest(dir), (err) => {
      assert.ok(err.problems.some(p => p.includes('fenced code block')))
      return true
    })
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
    { id: 'p1', title: "O'Brien", code: 's("bd")', tags: ['a', 'b'], sourceUrl: 'u', sourceAuthor: null, createdAt: '2026-09-01T00:00:00.000Z', favorite: true },
    { id: 'p2', title: 'Two', code: 's("sd")', tags: [], sourceUrl: 'u2', sourceAuthor: 'Ann', createdAt: '2026-09-01T00:00:01.000Z', favorite: false },
  ]

  test('encodes favorite as 0/1 and updates it on conflict', () => {
    const sql = toReconcileSql(entries)
    assert.ok(sql.includes("'2026-09-01T00:00:00.000Z', 'curated', 1)"))
    assert.ok(sql.includes("'2026-09-01T00:00:01.000Z', 'curated', 0)"))
    assert.ok(sql.includes('favorite=excluded.favorite'))
  })

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

  test('keeps a multi-line code value on one output line', () => {
    // A generated statement must stay on a single line: both the
    // vitest test-DB seed (test/apply-migrations.ts) and D1's exec()
    // binding split their input on '\n' to find statement boundaries,
    // so a raw embedded newline would corrupt one INSERT into
    // unparseable fragments (caught while implementing add-jah-chat,
    // via "Birds of a Feather"'s /* ... */-commented multi-line code).
    const multiline = [{ ...entries[0], code: '/*\n@title X\n*/\nsetcps(1)\nstack(\n  s("bd")\n)' }]
    const sql = toReconcileSql(multiline)
    const insertLine = sql.split('\n').find(line => line.startsWith('INSERT INTO patterns'))
    assert.ok(insertLine, 'the INSERT statement is a single line')
    assert.ok(insertLine.includes("CAST(x'"))
  })

  test('a hex-encoded multi-line value decodes back to the original text', () => {
    const original = 'line one\nline two\nline three'
    const multiline = [{ ...entries[0], code: original }]
    const sql = toReconcileSql(multiline)
    const match = /CAST\(x'([0-9a-f]+)' AS TEXT\)/.exec(sql)
    assert.ok(match, 'the code value was hex-encoded')
    assert.equal(Buffer.from(match[1], 'hex').toString('utf8'), original)
  })
})
