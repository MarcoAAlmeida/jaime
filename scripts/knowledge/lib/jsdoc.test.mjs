import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { test } from 'node:test'
import { buildJsdocCommand, extractDoclets } from './jsdoc.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_DOC_JSON = join(HERE, '..', '__fixtures__', 'doc.json')

test('buildJsdocCommand() runs jsdoc.js through node (not the shell shim), with every path genuinely absolute', () => {
  const outFile = join(tmpdir(), 'out', 'doc.json')
  const { cmd, args } = buildJsdocCommand('refers_to/strudel', outFile)
  const submoduleAbs = resolvePath('refers_to/strudel')

  // The .bin/jsdoc shim is a POSIX shell script — running it through plain
  // execFile fails on Windows (verified against the real submodule). Its
  // real entry point is run through `node` instead.
  assert.equal(cmd, process.execPath)
  // Genuinely absolute (not merely path-joined) — extractDoclets runs this
  // with cwd set to the submodule root (jsdoc's own plugin resolution
  // needs that), so a relative arg here would double up against that cwd,
  // a real bug this guards against.
  for (const p of [args[0], args[1], args[3], args[5], args[7]]) assert.ok(resolvePath(p) === p, `expected an absolute path, got ${p}`)

  assert.equal(args[0], join(submoduleAbs, '.jsdoc-tools', 'node_modules', 'jsdoc', 'jsdoc.js'))
  assert.equal(args[1], join(submoduleAbs, 'packages'))
  assert.deepEqual(args.slice(2, 4), ['--template', join(submoduleAbs, '.jsdoc-tools', 'node_modules', 'jsdoc-json')])
  assert.deepEqual(args.slice(4, 6), ['--destination', resolvePath(outFile)])
  assert.deepEqual(args.slice(6), ['-c', join(submoduleAbs, 'jsdoc', 'jsdoc.config.json')])
})

test('extractDoclets() runs the command and normalizes the resulting doclets, including an absolute meta.path made relative', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jah-knowledge-test-'))
  try {
    // jsdoc reports meta.path as an ABSOLUTE filesystem path (verified
    // against the real submodule) — build the fixture the same way, so
    // this test proves the relative conversion, not just a pass-through.
    const fixture = JSON.parse(readFileSync(FIXTURE_DOC_JSON, 'utf8'))
    fixture.docs[0].meta.path = join(resolvePath('refers_to/strudel'), 'packages', 'core')

    let invoked = null
    const exec = async (cmd, args, opts) => {
      invoked = { cmd, args, opts }
      const destIndex = args.indexOf('--destination')
      writeFileSync(args[destIndex + 1], JSON.stringify(fixture))
    }

    const doclets = await extractDoclets('refers_to/strudel', { exec, tmpDir })

    assert.equal(invoked.cmd, process.execPath)
    // Load-bearing: jsdoc.config.json's "jsdoc/jsdoc-synonyms" plugin entry
    // is resolved relative to the process cwd — running from anywhere
    // else fails with "Unable to find the plugin" (verified for real).
    assert.equal(invoked.opts.cwd, 'refers_to/strudel')
    assert.equal(doclets.length, 1)
    assert.deepEqual(doclets[0], {
      name: 'rev',
      longname: 'Pattern.rev',
      memberof: 'Pattern',
      description: '<p>Reverses a pattern: events that were early are now late, and vice versa.</p>',
      synonyms: ['reverse', 'flip'],
      tags: ['structure'],
      params: [{ name: 'pat', types: ['Pattern'], description: 'the pattern to reverse' }],
      examples: ['note("c d e g").rev()'],
      sourcePath: 'packages/core/sample-source.mjs',
    })
  }
  finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('a doclet missing optional fields still normalizes cleanly', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jah-knowledge-test-'))
  try {
    const exec = async (cmd, args) => {
      const destIndex = args.indexOf('--destination')
      writeFileSync(args[destIndex + 1], JSON.stringify({ docs: [{ name: 'bare', longname: 'bare' }] }))
    }
    const doclets = await extractDoclets('refers_to/strudel', { exec, tmpDir })
    assert.deepEqual(doclets[0], {
      name: 'bare',
      longname: 'bare',
      memberof: null,
      description: '',
      synonyms: [],
      tags: [],
      params: [],
      examples: [],
      sourcePath: null,
    })
  }
  finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('a failing jsdoc command is reported clearly, not silently producing an empty corpus', async () => {
  const exec = async () => { throw new Error('jsdoc: command not found') }
  await assert.rejects(() => extractDoclets('refers_to/strudel', { exec }), /extraction failed.*command not found/s)
})

test('unparsable or missing doc.json is reported clearly', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'jah-knowledge-test-'))
  try {
    const exec = async (cmd, args) => {
      const destIndex = args.indexOf('--destination')
      writeFileSync(args[destIndex + 1], 'not json at all {')
    }
    await assert.rejects(() => extractDoclets('refers_to/strudel', { exec, tmpDir }), /could not read jsdoc-json's output/)
  }
  finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})
