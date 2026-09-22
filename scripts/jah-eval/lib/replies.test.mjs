import assert from 'node:assert/strict'
import { test } from 'node:test'
import { balanced, fences, primaryBlock, score } from './replies.mjs'

test('fences() extracts label and code, including an unterminated fence', () => {
  const text = [
    'Sure, try this:',
    '```strudel',
    's("bd sd")',
    '```',
    'and then:',
    '```js',
    'note("c e g")',
  ].join('\n')
  const fs = fences(text)
  assert.equal(fs.length, 2)
  assert.deepEqual(fs[0], { label: 'strudel', code: 's("bd sd")\n' })
  assert.equal(fs[1].label, 'js')
  assert.equal(fs[1].code, 'note("c e g")')
})

test('balanced() accepts matched brackets/quotes and rejects the rest', () => {
  assert.equal(balanced('s("bd sd").lpf(800)'), true)
  assert.equal(balanced('s("bd sd"'), false)
  assert.equal(balanced('s("bd sd)'), false)
  assert.equal(balanced('s(\'it`s fine\')'), true)
  assert.equal(balanced('note(`c e'), false)
})

test('score() reports fenced/strudel/recoverable/silent/invented on a normal reply', () => {
  const s = score('```strudel\ns("bd sd")\n```')
  assert.deepEqual(s, { fenced: true, strudel: true, recoverable: true, silent: false, invented: false })
})

test('score() flags an unlabelled fence as recoverable but not strudel', () => {
  const s = score('```\nnote("c e g")\n```')
  assert.equal(s.fenced, true)
  assert.equal(s.strudel, false)
  assert.equal(s.recoverable, true)
})

test('score() flags an unbalanced strudel fence as not strudel (but still recoverable)', () => {
  const s = score('```strudel\ns("bd sd"\n```')
  assert.equal(s.strudel, false)
  assert.equal(s.recoverable, true)
})

test('score() treats an empty label as recoverable even with empty code (no trim requirement)', () => {
  const s = score('```\n```')
  assert.equal(s.recoverable, true)
})

test('score() flags an unloaded sound with no samples() call as silent', () => {
  const s = score('```strudel\ns("amen")\n```')
  assert.equal(s.silent, true)
})

test('score() does not flag silent when the pack is loaded', () => {
  const s = score('```strudel\nsamples(\'github:yaxu/clean-breaks/main\')\ns("amen")\n```')
  assert.equal(s.silent, false)
})

test('score() flags a made-up github pack as invented, a real one as not', () => {
  assert.equal(score('```strudel\nsamples(\'github:someone/made-up-pack\')\n```').invented, true)
  assert.equal(score('```strudel\nsamples(\'github:yaxu/clean-breaks/main\')\n```').invented, false)
})

test('primaryBlock() prefers a labelled, balanced strudel fence', () => {
  const text = '```js\nconsole.log(1)\n```\n```strudel\ns("bd sd")\n```'
  assert.equal(primaryBlock(text), 's("bd sd")\n')
})

test('primaryBlock() falls back to an unlabelled fence', () => {
  assert.equal(primaryBlock('```\nnote("c e g")\n```'), 'note("c e g")\n')
})

test('primaryBlock() strips a label put on the line after the fence', () => {
  const text = '```\nstrudel\ns("bd sd")\n```'
  assert.equal(primaryBlock(text), 's("bd sd")\n')
})

test('primaryBlock() still returns an unbalanced strudel fence\'s code (evaluation will fail it, not this)', () => {
  assert.equal(primaryBlock('```strudel\ns("bd sd"\n```'), 's("bd sd"\n')
})

test('primaryBlock() returns null with no fence at all', () => {
  assert.equal(primaryBlock('no code here at all'), null)
})

test('primaryBlock() skips an empty fence in favour of a later real one', () => {
  const text = '```\n```\n```strudel\ns("bd")\n```'
  assert.equal(primaryBlock(text), 's("bd")\n')
})
