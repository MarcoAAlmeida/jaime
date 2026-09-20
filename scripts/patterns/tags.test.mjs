import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tagCounts } from './tags.mjs'

test('counts each tag once per pattern, most-used first, ties alphabetical', () => {
  const entries = [
    { tags: ['drums', 'house', 'drums'] },
    { tags: ['house'] },
    { tags: ['acid', 'drums'] },
    { tags: [] },
  ]
  assert.deepEqual(tagCounts(entries), [
    { tag: 'drums', count: 2 },
    { tag: 'house', count: 2 },
    { tag: 'acid', count: 1 },
  ])
})

test('an empty library has no tags', () => {
  assert.deepEqual(tagCounts([]), [])
})
