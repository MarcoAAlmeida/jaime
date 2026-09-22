import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { buildCategoryMap, listPages, parsePage } from './pages.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, '..', '__fixtures__', 'pages')

function fixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8')
}

test('a page presenting functions via <JsDoc> produces associations, no concept chunks', () => {
  const result = parsePage('learn/time-modifiers.mdx', fixture('time-modifiers.mdx'))
  assert.equal(result.title, 'Time Modifiers')
  assert.deepEqual(result.associations, [
    { functionName: 'Pattern.rev', category: 'Time Modifiers' },
    { functionName: 'Pattern.fast', category: 'Time Modifiers' },
  ])
  // the H1's own intro sentence, before any <JsDoc> tag, is a real concept
  assert.deepEqual(result.concepts, [
    { heading: 'Time Modifiers', category: 'Time Modifiers', text: 'The following functions modify a pattern\'s temporal structure.' },
  ])
  assert.deepEqual(result.warnings, [])
})

test('a page with prose, a <MiniRepl> example, and a fenced code block produces both concept and example chunks', () => {
  const result = parsePage('learn/mini-notation.mdx', fixture('mini-notation.mdx'))
  assert.equal(result.title, 'Mini Notation')
  assert.deepEqual(result.associations, [])

  // three sections: the H1 intro, "Example", "Sequences"
  assert.equal(result.concepts.length, 3)
  assert.equal(result.concepts[0].heading, 'Mini-notation')
  assert.match(result.concepts[0].text, /compact language/)

  assert.equal(result.concepts[1].heading, 'Example')
  assert.match(result.concepts[1].text, /flavour/)
  assert.doesNotMatch(result.concepts[1].text, /<MiniRepl/) // the component tag is stripped from the prose

  assert.equal(result.concepts[2].heading, 'Sequences')
  assert.match(result.concepts[2].text, /```/) // fenced code stays intact in the concept's own text

  assert.equal(result.examples.length, 2)
  assert.equal(result.examples[0].heading, 'Example')
  assert.equal(result.examples[0].code, 'note("c e g")')
  assert.equal(result.examples[1].heading, 'Sequences')
  assert.equal(result.examples[1].code, 's("bd sd hh")')
})

test('a <JsDoc> tag with no name attribute warns and is skipped, without crashing the rest of the page', () => {
  const result = parsePage('learn/odd-shaped.mdx', fixture('odd-shaped.mdx'))
  assert.equal(result.associations.length, 0)
  assert.equal(result.warnings.length, 1)
  assert.match(result.warnings[0], /no "name" attribute/)

  // the section after the malformed one still parses as an ordinary concept
  assert.equal(result.concepts.length, 1)
  assert.equal(result.concepts[0].heading, 'A normal section afterwards')
})

test('a CRLF page (the real pages\' actual line ending) parses exactly like its LF equivalent', () => {
  const crlf = fixture('time-modifiers.mdx').replace(/\n/g, '\r\n')
  const lf = parsePage('learn/time-modifiers.mdx', fixture('time-modifiers.mdx'))
  const result = parsePage('learn/time-modifiers.mdx', crlf)
  assert.deepEqual(result, lf)
  assert.equal(result.title, 'Time Modifiers') // not a fallback — proves the frontmatter title itself was found
})

test('a page with no frontmatter title falls back to one derived from its filename, with a warning', () => {
  const result = parsePage('learn/untitled-page.mdx', '# Untitled\n\nSome text.\n')
  assert.equal(result.title, 'Untitled Page')
  assert.match(result.warnings[0], /no frontmatter title/)
})

test('listPages() lists only the fixed English directories, sorted, and never de/', () => {
  const tree = {
    learn: ['b.mdx', 'a.mdx', 'not-mdx.txt'],
    recipes: ['c.mdx'],
    de: ['sollte-nicht-erscheinen.mdx'],
    intro: ['showcase.mdx'], // a real page directory, deliberately not in PAGE_DIRECTORIES
  }
  const readdirSync = dir => tree[dir.split('/').pop()] ?? []
  const pages = listPages('website/src/pages', { readdirSync })
  assert.deepEqual(pages, ['learn/a.mdx', 'learn/b.mdx', 'recipes/c.mdx'])
})

test('listPages() tolerates a missing directory instead of throwing', () => {
  const pages = listPages('website/src/pages', { readdirSync: () => { throw new Error('ENOENT') } })
  assert.deepEqual(pages, [])
})

test('buildCategoryMap() lets the first page in order win, and logs the repeat', () => {
  const pages = [
    { path: 'learn/a.mdx', parsed: { associations: [{ functionName: 'rev', category: 'A' }] } },
    { path: 'learn/b.mdx', parsed: { associations: [{ functionName: 'rev', category: 'B' }, { functionName: 'fast', category: 'B' }] } },
  ]
  const { categoryByFunction, warnings } = buildCategoryMap(pages)
  assert.equal(categoryByFunction.get('rev'), 'A')
  assert.equal(categoryByFunction.get('fast'), 'B')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /rev.*already categorized as "A"/)
})
