// Runs the submodule's OWN jsdoc/jsdoc-json against its OWN packages/ with
// its OWN config, and reads back the doc.json it produces
// (add-strudel-knowledge-corpus task 3.1). Every doclet is normalized to
// the fields the rest of the pipeline needs — see design.md decisions 3
// (why we shell out to the submodule's own tooling rather than
// re-implementing JSDoc parsing) and the discovered `@tags` field.

import { execFile } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve as resolvePath } from 'node:path'
import { promisify } from 'node:util'
import { jsdocToolsDir } from './submodule.mjs'

const execFileAsync = promisify(execFile)

async function defaultExec(cmd, args, opts) {
  await execFileAsync(cmd, args, opts)
}

/**
 * Builds the exact `jsdoc` invocation the submodule's own `jsdoc-json`
 * npm script runs, with every path made absolute so it works regardless
 * of the current working directory. `jsdoc`'s own `node_modules/.bin/jsdoc`
 * is a POSIX shell shim, not something `execFile` can run directly on
 * every platform — its real entry point, `jsdoc/jsdoc.js`, is run through
 * `node` instead (verified against the real submodule, 2026-09-22: the
 * shim throws a syntax error under plain `execFile` on Windows).
 * `jsdoc`/`jsdoc-json` live in the isolated tools directory
 * (`submodule.mjs`'s `jsdocToolsDir`), never the submodule's own root.
 */
export function buildJsdocCommand(submodulePath, outFile) {
  // Genuinely absolute — extractDoclets runs this with cwd set to the
  // submodule root (jsdoc's plugin resolution needs that), so a relative
  // path here would resolve against THAT cwd and double up
  // (refers_to/strudel/refers_to/strudel/... — a real bug this fixes).
  const submoduleAbs = resolvePath(submodulePath)
  const toolsDir = jsdocToolsDir(submoduleAbs)
  return {
    cmd: process.execPath,
    args: [
      join(toolsDir, 'node_modules', 'jsdoc', 'jsdoc.js'),
      join(submoduleAbs, 'packages'),
      '--template', join(toolsDir, 'node_modules', 'jsdoc-json'),
      '--destination', resolvePath(outFile),
      '-c', join(submoduleAbs, 'jsdoc', 'jsdoc.config.json'),
    ],
  }
}

/**
 * Runs jsdoc-json against `submodulePath` and returns its doclets,
 * normalized. `doc.json` is written to the OS temp directory (or
 * `tmpDir` if given) and never committed — it's regenerable and a
 * different (site-oriented) shape than our chunk schema.
 *
 * @param {string} submodulePath
 * @param {{ exec?: typeof defaultExec, tmpDir?: string, readFile?: typeof readFileSync }} [options]
 */
export async function extractDoclets(submodulePath, { exec = defaultExec, tmpDir, readFile = readFileSync } = {}) {
  const dir = tmpDir ?? mkdtempSync(join(tmpdir(), 'jah-knowledge-jsdoc-'))
  const outFile = join(dir, 'doc.json')
  const { cmd, args } = buildJsdocCommand(submodulePath, outFile)

  try {
    // cwd matters here, not just for tidiness: jsdoc.config.json's own
    // "jsdoc/jsdoc-synonyms" plugin entry is a specifier jsdoc resolves
    // relative to the process's cwd, exactly like the submodule's own
    // `npm run jsdoc-json` script (which always runs from the submodule
    // root) — verified against the real submodule, 2026-09-22: running
    // from any other cwd fails with "Unable to find the plugin".
    await exec(cmd, args, { cwd: submodulePath })
  }
  catch (err) {
    throw new Error(`jsdoc-json extraction failed (${err.message})`)
  }

  let raw
  try {
    raw = JSON.parse(readFile(outFile, 'utf8'))
  }
  catch (err) {
    throw new Error(`could not read jsdoc-json's output at ${outFile} (${err.message})`)
  }

  return normalizeDoclets(raw.docs ?? [], submodulePath)
}

function normalizeDoclets(docs, submodulePath) {
  // jsdoc reports meta.path as an ABSOLUTE filesystem path (verified
  // against the real submodule, 2026-09-22 — it is NOT relative, despite
  // what an earlier draft of this file assumed). Made relative to the
  // submodule root here so the corpus never bakes in a machine-specific
  // path.
  const submoduleAbs = resolvePath(submodulePath)

  return docs.map(d => ({
    name: d.name,
    longname: d.longname,
    memberof: d.memberof ?? null,
    description: d.description ?? '',
    synonyms: d.synonyms ?? [],
    tags: d.tags ?? [],
    params: (d.params ?? []).map(p => ({ name: p.name, types: p.type?.names ?? [], description: p.description ?? '' })),
    examples: d.examples ?? [],
    sourcePath: sourcePathOf(d.meta, submoduleAbs),
  }))
}

function sourcePathOf(meta, submoduleAbs) {
  if (!meta?.filename) return null
  const dir = meta.path && isAbsolute(meta.path) ? relative(submoduleAbs, meta.path) : (meta.path ?? '')
  return [dir, meta.filename].filter(Boolean).join('/').replaceAll('\\', '/')
}
