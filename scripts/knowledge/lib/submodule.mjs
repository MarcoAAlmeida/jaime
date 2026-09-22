// Ensures refers_to/strudel is checked out at its pinned commit, and that
// the submodule's own jsdoc/jsdoc-json tooling is installed inside it
// (add-strudel-knowledge-corpus tasks 2.1-2.2). Every real git/npm call
// goes through an injectable `exec`, so tests never touch the network or
// the real submodule — see design.md decisions 2-3.

import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

export const SUBMODULE_PATH = 'refers_to/strudel'

// refers_to/strudel's OWN root package.json is a pnpm workspace whose
// internal packages reference each other via the `workspace:*` protocol —
// something plain `npm install` cannot resolve at all (it fails with
// EUNSUPPORTEDPROTOCOL) even when only installing one unrelated package,
// because npm reads and validates the whole ambient package.json first.
// jsdoc/jsdoc-json go into this isolated subdirectory instead, with their
// own minimal package.json, so npm never has to see the submodule's real
// one. Verified against the real submodule (2026-09-22).
export const TOOLS_DIR_NAME = '.jsdoc-tools'

const execFileAsync = promisify(execFile)

async function defaultExec(cmd, args, opts) {
  const { stdout } = await execFileAsync(cmd, args, opts)
  return { stdout }
}

/**
 * Checks out `refers_to/strudel` at its pinned commit if it isn't already
 * — `git submodule status` prefixes a line with `-` when uninitialized or
 * `+` when checked out at a different commit than the index; only a
 * leading space means "already at the pin". Throws a clear error if git
 * itself is unavailable or the submodule isn't registered.
 *
 * @param {{ exec?: typeof defaultExec, cwd?: string }} [options]
 * @returns {Promise<{ updated: boolean }>}
 */
export async function ensureSubmodule({ exec = defaultExec, cwd = process.cwd() } = {}) {
  let status
  try {
    status = await exec('git', ['submodule', 'status', '--', SUBMODULE_PATH], { cwd })
  }
  catch (err) {
    throw new Error(`could not read git submodule status for ${SUBMODULE_PATH} — is git available? (${err.message})`)
  }
  // The leading character is the status indicator itself (' ' = up to
  // date, '-' = uninitialized, '+' = wrong commit) — trimming the whole
  // string would destroy a leading space before we ever get to read it.
  const line = status.stdout.split('\n').find(l => l.length > 0) ?? ''
  if (!line) throw new Error(`git submodule status returned nothing for ${SUBMODULE_PATH} — is it registered in .gitmodules?`)

  const upToDate = line[0] === ' '
  if (upToDate) return { updated: false }

  try {
    // `--checkout` is load-bearing: .gitmodules (deliberately) sets
    // `update = none` for this submodule so an ordinary `git submodule
    // update` never touches it — but that also makes plain `--init` a
    // silent no-op ("Skipping submodule ...", exit 0, nothing checked
    // out) for this same reason. `--checkout` explicitly overrides the
    // configured update mode for this one deliberate call.
    await exec('git', ['submodule', 'update', '--init', '--checkout', '--depth', '1', '--', SUBMODULE_PATH], { cwd })
  }
  catch (err) {
    throw new Error(`git submodule update --init failed for ${SUBMODULE_PATH} (${err.message})`)
  }
  return { updated: true }
}

/** Where jsdoc/jsdoc-json actually live — see the TOOLS_DIR_NAME comment above. */
export function jsdocToolsDir(submoduleDir) {
  return join(submoduleDir, TOOLS_DIR_NAME)
}

/**
 * Installs `jsdoc`/`jsdoc-json` into an isolated subdirectory of the
 * submodule (never its own root — see `TOOLS_DIR_NAME`), at exactly the
 * version ranges the submodule's own root package.json pins — so
 * extraction always runs the same tool version Strudel's own docs are
 * built with — only when they aren't already resolvable there.
 * `--no-save`/`--no-package-lock` mean nothing here is ever committed by
 * us; the isolated directory's own package.json is created once and
 * reused, itself untracked (this is dev tooling state, like
 * `node_modules`, not a change to the submodule's real content).
 *
 * @param {{ exec?: typeof defaultExec, resolveInTools?: (name: string) => boolean, cwd?: string, submodulePath?: string }} [options]
 * @returns {Promise<{ installed: boolean }>}
 */
export async function ensureJsdocTooling({
  exec = defaultExec,
  resolveInTools,
  cwd = process.cwd(),
  submodulePath = SUBMODULE_PATH,
} = {}) {
  const submoduleDir = join(cwd, submodulePath)
  const toolsDir = jsdocToolsDir(submoduleDir)
  const resolve = resolveInTools ?? (name => defaultResolveInDir(toolsDir, name))

  if (resolve('jsdoc-json') && resolve('jsdoc')) return { installed: false }

  if (!existsSync(toolsDir)) mkdirSync(toolsDir, { recursive: true })
  if (!existsSync(join(toolsDir, 'package.json'))) {
    writeFileSync(join(toolsDir, 'package.json'), JSON.stringify({ name: 'jah-knowledge-jsdoc-tools', private: true }))
  }

  const devDeps = readSubmodulePackageJson(submoduleDir).devDependencies ?? {}
  const specs = ['jsdoc', 'jsdoc-json'].map(name => `${name}@${devDeps[name] ?? 'latest'}`)
  await exec('npm', ['install', '--no-save', '--no-package-lock', '--no-audit', '--no-fund', ...specs], { cwd: toolsDir })
  return { installed: true }
}

function readSubmodulePackageJson(submoduleDir) {
  return JSON.parse(readFileSync(join(submoduleDir, 'package.json'), 'utf8'))
}

// Checks the exact directory only — NOT Node's ordinary module resolution,
// which climbs ancestor node_modules directories and could report a false
// "already installed" from something unrelated higher up the tree.
function defaultResolveInDir(dir, name) {
  return existsSync(join(dir, 'node_modules', name, 'package.json'))
}
