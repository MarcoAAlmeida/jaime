import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertParsedSubcategory,
  buildInsertSql,
  decodeHtmlEntities,
  extractArtPieces,
  extractSubcategorySlugs,
} from './ascii-gallery-scraper.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = name => readFileSync(join(__dirname, '__fixtures__', name), 'utf8')

test('decodeHtmlEntities decodes named and numeric entities', () => {
  assert.equal(decodeHtmlEntities('o&#039;&#039;))_____\\\\'), 'o\'\'))_____\\\\')
  assert.equal(decodeHtmlEntities('&quot;--__/'), '"--__/')
  assert.equal(decodeHtmlEntities('a &amp; b'), 'a & b')
  assert.equal(decodeHtmlEntities('plain text'), 'plain text')
})

test('extractSubcategorySlugs finds every unique subcategory link', () => {
  const html = fixture('toys-category-sample.html')
  const slugs = extractSubcategorySlugs(html, 'toys')
  assert.deepEqual(slugs.sort(), [
    'balloons',
    'beanie-babies',
    'dolls',
    'other',
    'pez',
    'teddy-bears',
  ])
})

test('extractArtPieces parses id, metadata, dimensions and decoded text for every card', () => {
  const html = fixture('dogs-sample.html')
  const pieces = extractArtPieces(html, 'animals', 'dogs')
  assert.equal(pieces.length, 3)

  const [unknownOne, named, unknownTwo] = pieces

  assert.equal(unknownOne.id, 'a554c60e4afb8f4b')
  assert.equal(unknownOne.title, null)
  assert.equal(unknownOne.artist, null) // "unknown" artist normalizes to null
  assert.equal(unknownOne.width, 14)
  assert.equal(unknownOne.height, 4)
  assert.equal(unknownOne.text, '  __    __\no-\'\'))_____\\\\\n"--__/ * * * )\nc_c__/-c____/')
  assert.ok(!unknownOne.text.includes('\r'))

  assert.equal(named.id, 'cf6bbc9460003289')
  assert.equal(named.title, 'Dog')
  assert.equal(named.artist, 'Maija Haavisto')
  assert.equal(named.width, 11)
  assert.equal(named.height, 4)

  assert.equal(unknownTwo.id, '491b7f288951bae9')
  assert.match(unknownTwo.text, /'\(\)'--o/) // decoded apostrophes survive inside the art
})

test('extractArtPieces returns nothing for a category-index page (no cards)', () => {
  const html = fixture('toys-category-sample.html')
  assert.deepEqual(extractArtPieces(html, 'toys', 'n/a'), [])
})

test('assertParsedSubcategory throws only when cards exist but nothing parsed', () => {
  const withCards = fixture('dogs-sample.html')
  assert.doesNotThrow(() => assertParsedSubcategory({
    html: withCards,
    pieces: extractArtPieces(withCards, 'animals', 'dogs'),
    category: 'animals',
    subcategory: 'dogs',
  }))

  assert.throws(
    () => assertParsedSubcategory({ html: withCards, pieces: [], category: 'animals', subcategory: 'dogs' }),
    /markup likely changed/,
  )

  const withoutCards = fixture('toys-category-sample.html')
  assert.doesNotThrow(() => assertParsedSubcategory({
    html: withoutCards,
    pieces: [],
    category: 'toys',
    subcategory: 'n/a',
  }))

  // A genuinely empty subcategory page: its inline JS references the
  // `.art-card` CSS class (present on every page, card or no card),
  // but there's no actual card markup — must NOT be flagged as broken.
  const genuinelyEmpty = fixture('empty-subcategory-sample.html')
  assert.doesNotThrow(() => assertParsedSubcategory({
    html: genuinelyEmpty,
    pieces: [],
    category: 'animals',
    subcategory: 'insects',
  }))
})

test('buildInsertSql escapes quotes and produces one upserting statement per row', () => {
  const rows = [
    { id: 'abc', title: 'It\'s a dog', artist: null, category: 'animals', subcategory: 'dogs', width: 3, height: 1, text: 'o/' },
  ]
  const sql = buildInsertSql(rows, '2026-09-15T00:00:00.000Z')
  assert.match(sql, /INSERT INTO ascii_art/)
  assert.match(sql, /'It''s a dog'/)
  assert.match(sql, /'https:\/\/www\.asciiart\.eu\/art\/abc'/)
  assert.match(sql, /ON CONFLICT\(id\) DO UPDATE SET/)
})
