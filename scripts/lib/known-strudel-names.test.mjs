import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
// Imported straight from the TypeScript source — proves plain `node`
// scripts can use the shared analysis (Node's type stripping).
import { analyzeStrudel, unknownNames } from '../../shared/strudel/index.ts'
import { readManifest } from './patterns-manifest.mjs'
import { knownNamesFromChunks, readKnownStrudelNames } from './known-strudel-names.mjs'

describe('knownNamesFromChunks', () => {
  test('takes function titles and synonyms, ignores other chunk kinds', () => {
    const names = knownNamesFromChunks([
      { kind: 'function', title: 'lpf', synonyms: ['cutoff', 'ctf', 'lp'] },
      { kind: 'function', title: 'rev' },
      { kind: 'concept', title: 'Sequences' },
      { kind: 'example', title: 'note' },
    ])
    assert.deepEqual([...names].sort(), ['ctf', 'cutoff', 'lp', 'lpf', 'rev'])
  })
})

describe('readKnownStrudelNames (real corpus)', () => {
  const known = readKnownStrudelNames()

  test('knows common functions and synonyms', () => {
    for (const name of ['note', 's', 'stack', 'lpf', 'cutoff', 'sine']) assert.ok(known.has(name), name)
  })

  test('a real library pattern analyses through unknownNames from Node', () => {
    const entry = readManifest().find(e => e.id === 'amen-roll') ?? readManifest()[0]
    const analysis = analyzeStrudel(entry.code)
    assert.deepEqual(analysis.errors, [])
    assert.ok(analysis.names.length > 0)
    const unknown = unknownNames(analysis, known)
    assert.ok(unknown.length < analysis.names.length)
  })

  test('a misspelling is reported', () => {
    const unknown = unknownNames(analyzeStrudel('note("c").lpff(800)'), known)
    assert.deepEqual(unknown.map(n => n.name), ['lpff'])
  })
})
