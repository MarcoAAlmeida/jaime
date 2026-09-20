// Run with `npm run test:scripts`. Plain Node tests over a temp manifest dir.

import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { normalizeCode, readManifest } from '../lib/patterns-manifest.mjs'
import { renderPattern, slugify, writePatterns } from './write.mjs'

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'write-test-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

const spec = (over = {}) => ({
  title: 'Four on the floor',
  sourceUrl: 'https://example.com/a',
  code: 's("bd*4")',
  tags: ['drums', 'house'],
  ...over,
})
const files = () => readdirSync(dir).filter(f => f.endsWith('.md')).sort()

describe('slugify', () => {
  test('kebab-cases, strips diacritics and punctuation', () => {
    assert.equal(slugify('Birds of a Feather (remake)'), 'birds-of-a-feather-remake')
    assert.equal(slugify('  Amélie — Waltz!! '), 'amelie-waltz')
    assert.equal(slugify('!!!'), '')
  })
})

describe('writePatterns: creating', () => {
  test('creates a file that reads back as the same pattern', () => {
    const [r] = writePatterns([spec({ author: 'Ann', favorite: true })], { dir })
    assert.equal(r.action, 'created')
    assert.equal(r.id, 'four-on-the-floor')
    const [e] = readManifest(dir)
    assert.deepEqual(
      { id: e.id, title: e.title, code: e.code, tags: e.tags, sourceUrl: e.sourceUrl, sourceAuthor: e.sourceAuthor, favorite: e.favorite },
      { id: 'four-on-the-floor', title: 'Four on the floor', code: 's("bd*4")', tags: ['drums', 'house'], sourceUrl: 'https://example.com/a', sourceAuthor: 'Ann', favorite: true },
    )
  })

  test('stores code byte-for-byte: comments, indentation, blank lines, backticks', () => {
    const code = [
      '// "The Title"',
      '// script @by someone',
      '',
      '  const magic = `<G@3 Bm>`   // odd indent + trailing comment',
      '```',
      '$: s("bd*4")',
      '    .gain(.5)',
    ].join('\n')
    writePatterns([spec({ code })], { dir })
    assert.equal(readManifest(dir)[0].code, code)
    const text = readFileSync(join(dir, 'four-on-the-floor.md'), 'utf8')
    assert.match(text, /````strudel\n/, 'a longer fence is used because the code contains ```')
  })

  test('normalises CRLF input to LF and trims blank edges only', () => {
    writePatterns([spec({ code: '\r\n\r\n$: s("bd")\r\n  .fast(2)  \r\n\r\n' })], { dir })
    const text = readFileSync(join(dir, 'four-on-the-floor.md'), 'utf8')
    assert.ok(!text.includes('\r'))
    assert.equal(readManifest(dir)[0].code, '$: s("bd")\n  .fast(2)')
    assert.equal(readManifest(dir)[0].code, normalizeCode('$: s("bd")\r\n  .fast(2)'))
  })

  test('survives titles and authors that need YAML quoting', () => {
    writePatterns([spec({ title: 'A: "quoted" #hash', author: "O'Brien: & co" })], { dir })
    const [e] = readManifest(dir)
    assert.equal(e.title, 'A: "quoted" #hash')
    assert.equal(e.sourceAuthor, "O'Brien: & co")
  })

  test('uses the given id, and derives one from the title otherwise', () => {
    writePatterns([spec({ id: 'my-id' }), spec({ title: 'Other one', sourceUrl: 'https://example.com/b' })], { dir })
    assert.deepEqual(files(), ['my-id.md', 'other-one.md'])
  })

  test('a batch keeps its order via created_at', () => {
    writePatterns([spec({ title: 'B', sourceUrl: 'https://e.com/1' }), spec({ title: 'A', sourceUrl: 'https://e.com/2' })], { dir, now: Date.parse('2026-09-21T00:00:00Z') })
    const byId = Object.fromEntries(readManifest(dir).map(e => [e.id, e.createdAt]))
    assert.ok(byId.b < byId.a)
  })

  test('--dry-run writes nothing', () => {
    const [r] = writePatterns([spec()], { dir, dryRun: true })
    assert.equal(r.action, 'would-create')
    assert.deepEqual(files(), [])
  })
})

describe('writePatterns: repeat runs', () => {
  test('the same source and content is a no-op that leaves the file untouched', () => {
    writePatterns([spec()], { dir })
    const before = readFileSync(join(dir, 'four-on-the-floor.md'), 'utf8')
    const [r] = writePatterns([spec()], { dir })
    assert.equal(r.action, 'unchanged')
    assert.equal(readFileSync(join(dir, 'four-on-the-floor.md'), 'utf8'), before)
    assert.equal(files().length, 1)
  })

  test('changed code is reported, and only written with update — under the same id', () => {
    writePatterns([spec()], { dir })
    const changed = spec({ code: 's("bd*8")', id: 'a-different-id' })
    const [w] = writePatterns([changed], { dir })
    assert.equal(w.action, 'would-update')
    assert.deepEqual(w.changes, ['code'])
    assert.equal(readManifest(dir)[0].code, 's("bd*4")')

    const [u] = writePatterns([changed], { dir, update: true })
    assert.equal(u.action, 'updated')
    assert.equal(u.id, 'four-on-the-floor', 'an existing pattern never changes id')
    assert.equal(readManifest(dir)[0].code, 's("bd*8")')
    assert.deepEqual(files(), ['four-on-the-floor.md'])
  })

  test('an update keeps created_at and unspecified fields', () => {
    writePatterns([spec({ author: 'Ann', favorite: true })], { dir })
    const created = readManifest(dir)[0].createdAt
    writePatterns([{ title: 'Four on the floor', sourceUrl: 'https://example.com/a', code: 's("bd*8")' }], { dir, update: true })
    const [e] = readManifest(dir)
    assert.equal(e.createdAt, created)
    assert.equal(e.sourceAuthor, 'Ann')
    assert.equal(e.favorite, true)
    assert.deepEqual(e.tags, ['drums', 'house'])
  })
})

describe('writePatterns: refusing', () => {
  test('an id already used by a different source is a collision; nothing is written', () => {
    writePatterns([spec()], { dir })
    const [r] = writePatterns([spec({ sourceUrl: 'https://example.com/other', code: 's("sd")' })], { dir })
    assert.equal(r.action, 'collision')
    assert.match(r.message, /four-on-the-floor-2/)
    assert.equal(files().length, 1)
    assert.equal(readManifest(dir)[0].code, 's("bd*4")')
  })

  test('missing source, empty code, bad id are invalid and write nothing', () => {
    const results = writePatterns([
      spec({ sourceUrl: '' }),
      spec({ code: '   \n' }),
      spec({ id: 'Not Kebab', sourceUrl: 'https://example.com/z' }),
      spec({ sourceUrl: 'not a url' }),
    ], { dir })
    assert.deepEqual(results.map(r => r.action), ['invalid', 'invalid', 'invalid', 'invalid'])
    assert.deepEqual(files(), [])
  })

  test('a failure in one item does not stop the others', () => {
    const results = writePatterns([spec({ sourceUrl: '' }), spec({ title: 'Fine', sourceUrl: 'https://example.com/ok' })], { dir })
    assert.deepEqual(results.map(r => r.action), ['invalid', 'created'])
  })

  test('refuses to add to a manifest that is already invalid', () => {
    writeFileSync(join(dir, 'broken.md'), 'no frontmatter')
    const [r] = writePatterns([spec()], { dir })
    assert.equal(r.action, 'invalid')
    assert.match(r.message, /already invalid/)
  })
})

describe('renderPattern', () => {
  test('matches the existing house style: flow tags, fenced strudel block', () => {
    const text = renderPattern(spec({ author: 'Ann' }))
    assert.match(text, /^---\ntitle: Four on the floor\ntags: \[drums, house\]\nsource_url: https:\/\/example\.com\/a\nsource_author: Ann\n---\n\n```strudel\ns\("bd\*4"\)\n```\n$/)
  })
})
