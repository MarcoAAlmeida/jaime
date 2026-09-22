import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ensureJsdocTooling, ensureSubmodule, SUBMODULE_PATH } from './submodule.mjs'

test('ensureSubmodule() is a no-op when the submodule is already at its pinned commit', async () => {
  const calls = []
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args])
    return { stdout: ' 8f81463 refers_to/strudel (heads/main)\n' }
  }
  const result = await ensureSubmodule({ exec })
  assert.deepEqual(result, { updated: false })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], ['git', 'submodule', 'status', '--', SUBMODULE_PATH])
})

test('ensureSubmodule() initializes an uninitialized submodule', async () => {
  const calls = []
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args])
    if (args[1] === 'status') return { stdout: '-8f81463 refers_to/strudel\n' }
    return { stdout: '' }
  }
  const result = await ensureSubmodule({ exec })
  assert.deepEqual(result, { updated: true })
  assert.equal(calls.length, 2)
  // --checkout is load-bearing (see the comment in submodule.mjs): without
  // it, git silently skips a submodule configured with `update = none` —
  // exit 0, nothing checked out. A regression here would look like success
  // and fail much later, confusingly, when extraction can't find files.
  assert.deepEqual(calls[1], ['git', 'submodule', 'update', '--init', '--checkout', '--depth', '1', '--', SUBMODULE_PATH])
})

test('ensureSubmodule() updates a submodule checked out at the wrong commit', async () => {
  const exec = async (cmd, args) => {
    if (args[1] === 'status') return { stdout: '+deadbeef refers_to/strudel (heads/main)\n' }
    return { stdout: '' }
  }
  const result = await ensureSubmodule({ exec })
  assert.deepEqual(result, { updated: true })
})

test('ensureSubmodule() reports a clear error when git itself fails', async () => {
  const exec = async () => { throw new Error('git: command not found') }
  await assert.rejects(() => ensureSubmodule({ exec }), /git submodule status.*git: command not found/s)
})

test('ensureSubmodule() reports a clear error when the submodule is not registered', async () => {
  const exec = async () => ({ stdout: '' })
  await assert.rejects(() => ensureSubmodule({ exec }), /nothing.*registered in \.gitmodules/s)
})

test('ensureSubmodule() reports a clear error when the update itself fails', async () => {
  const exec = async (cmd, args) => {
    if (args[1] === 'status') return { stdout: '-8f81463 refers_to/strudel\n' }
    throw new Error('network unreachable')
  }
  await assert.rejects(() => ensureSubmodule({ exec }), /update --init failed.*network unreachable/s)
})

test('ensureJsdocTooling() is a no-op when both packages already resolve in the isolated tools directory', async () => {
  let execCalled = false
  const exec = async () => { execCalled = true; return { stdout: '' } }
  const result = await ensureJsdocTooling({ exec, resolveInTools: () => true })
  assert.deepEqual(result, { installed: false })
  assert.equal(execCalled, false)
})

test('ensureJsdocTooling() installs into the isolated .jsdoc-tools directory, not the submodule\'s own root', async () => {
  const { mkdtempSync, existsSync, rmSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const dir = mkdtempSync(join(tmpdir(), 'jah-knowledge-test-'))
  // A submodule root that would break plain `npm install` if we ever ran
  // it there (the real refers_to/strudel/package.json has real
  // workspace:* deps) — proves ensureJsdocTooling never touches it.
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    devDependencies: { jsdoc: '^4.0.4', 'jsdoc-json': '^2.0.2' },
    dependencies: { '@strudel/core': 'workspace:*' },
  }))

  try {
    const calls = []
    const exec = async (cmd, args, opts) => { calls.push({ cmd, args, opts }) }
    const result = await ensureJsdocTooling({ exec, resolveInTools: () => false, cwd: dir, submodulePath: '.' })
    const toolsDir = join(dir, '.jsdoc-tools')

    assert.deepEqual(result, { installed: true })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].cmd, 'npm')
    assert.deepEqual(calls[0].args, ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', 'jsdoc@^4.0.4', 'jsdoc-json@^2.0.2'])
    // The install runs in the isolated directory, never in the submodule root.
    assert.equal(calls[0].opts.cwd, toolsDir)
    assert.notEqual(calls[0].opts.cwd, dir)
    assert.ok(existsSync(join(toolsDir, 'package.json')), 'creates its own minimal package.json')
    const written = JSON.parse((await import('node:fs')).readFileSync(join(toolsDir, 'package.json'), 'utf8'))
    assert.equal(written.dependencies, undefined) // no workspace:* leaked in
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('ensureJsdocTooling() reuses an already-written isolated package.json rather than overwriting it', async () => {
  const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')

  const dir = mkdtempSync(join(tmpdir(), 'jah-knowledge-test-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ devDependencies: {} }))
  const toolsDir = join(dir, '.jsdoc-tools')
  mkdirSync(toolsDir, { recursive: true })
  writeFileSync(join(toolsDir, 'package.json'), '{"custom":true}')

  try {
    const exec = async () => {}
    await ensureJsdocTooling({ exec, resolveInTools: () => false, cwd: dir, submodulePath: '.' })
    assert.equal(readFileSync(join(toolsDir, 'package.json'), 'utf8'), '{"custom":true}')
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
