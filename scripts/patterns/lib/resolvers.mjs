// Turn a source (link, repo, file, stdin) into Strudel code candidates —
// the deterministic half of the add-patterns skill's "Resolve" step
// (add-pattern-ingestion-skill, design decision 3). Network and disk are
// injected (`deps`) so every branch is testable offline.
//
// resolveSource() never throws for an expected failure; it returns
//   { ok: true,  candidates: Candidate[], skipped: [], notes: [] }
//   { ok: false, reason, message }
// Candidate: { code, sourceUrl, path?, hints:{title,author,license}, existing?, helper?, notes[] }
//
// Failure reasons: unsupported | needs-reader | not-strudel | not-base64 |
//   short-link-unavailable | http | not-found | needs-source-url | error

import { existsSync, readFileSync } from 'node:fs'
import { readManifest } from '../../lib/patterns-manifest.mjs'

export class ResolveError extends Error {
  constructor(reason, message) {
    super(message)
    this.name = 'ResolveError'
    this.reason = reason
  }
}

const CODE_EXT = /\.(?:js|mjs|strudel|str|txt)$/i
const HELPER_DIRS = new Set(['functions', 'function', 'lib', 'libs', 'helpers', 'helper', 'utils', 'util', 'common', 'shared', 'vendor'])
const SKIP_DIRS = new Set(['node_modules'])
const MAX_FILE_BYTES = 100_000
const DEFAULT_MAX_CANDIDATES = 500

// ---- small helpers --------------------------------------------------------

function defaults(deps = {}) {
  return {
    fetch: deps.fetch ?? globalThis.fetch,
    readFile: deps.readFile ?? (p => readFileSync(p, 'utf8')),
    exists: deps.exists ?? existsSync,
    stdin: deps.stdin ?? (() => readFileSync(0, 'utf8')),
    library: deps.library,
    sourceUrl: deps.sourceUrl,
    maxCandidates: deps.maxCandidates ?? DEFAULT_MAX_CANDIDATES,
  }
}

async function getText(d, url, headers) {
  let res
  try {
    res = await d.fetch(url, headers ? { headers } : undefined)
  }
  catch (err) {
    throw new ResolveError('http', `could not reach ${url}: ${err.message}`)
  }
  if (res.status === 404) throw new ResolveError('not-found', `${url} does not exist (404)`)
  if (!res.ok) throw new ResolveError('http', `${url} answered ${res.status}`)
  return { text: await res.text(), contentType: res.headers?.get?.('content-type') ?? '' }
}

async function getJson(d, url, headers) {
  const { text } = await getText(d, url, headers)
  try {
    return JSON.parse(text)
  }
  catch {
    throw new ResolveError('http', `${url} did not return JSON`)
  }
}

function looksLikeHtml(text, contentType) {
  return /text\/html/i.test(contentType) || /^\s*<(?:!doctype html|html)\b/i.test(text)
}

/** Refuse code that is plainly another live-coding system. Permissive otherwise. */
export function notStrudelReason(code) {
  if (!code.trim()) return 'the file is empty'
  if (/^\s*d\d+\s*\$/m.test(code) || /\bhush\b.*\bd1\b/.test(code)) return 'looks like TidalCycles (d1 $ …)'
  if (/\blive_loop\b|\buse_synth\b|\bplay\s+:\w+/.test(code)) return 'looks like Sonic Pi'
  if (/\bSynthDef\b|\bPbind\b|\bNdef\b|\bProxySpace\b/.test(code)) return 'looks like SuperCollider'
  return null
}

/**
 * Title / author / licence hints from the leading comment block — the
 * strudel.cc convention (`@title`, `@by`, `@license`) and the common
 * `// "Title"` first line. Hints only: the skill judges.
 */
export function parseHeader(code) {
  const head = code.replace(/\r\n?/g, '\n').split('\n').slice(0, 12).join('\n')
  const hints = {}
  const at = (tag) => {
    const m = new RegExp(`@${tag}\\s+([^\\n*]+)`, 'i').exec(head)
    return m ? m[1].trim() : undefined
  }
  const title = at('title')
  if (title) hints.title = title
  else {
    const m = /^\s*\/\/\s*["“'‘](.+?)["”'’](?:\s.*)?$/m.exec(head)
    if (m) hints.title = m[1].trim()
  }
  const by = at('by')
  if (by) hints.author = by.replace(/\s*<[^>]*>\s*$/, '').trim()
  const license = at('license')
  if (license) hints.license = license
  return hints
}

function libraryEntries(d) {
  if (d.library) return d.library
  try {
    return readManifest()
  }
  catch {
    return []
  }
}

function makeCandidate(d, lib, { code, sourceUrl, path }) {
  const notes = []
  const existing = sourceUrl ? lib.find(e => e.sourceUrl === sourceUrl)?.id : undefined
  if (existing) notes.push(`already in the library as '${existing}'`)
  if (!sourceUrl) notes.push('no source URL — one must be supplied before this can be added')
  const c = { code, sourceUrl: sourceUrl ?? null, hints: parseHeader(code), notes }
  if (path) c.path = path
  if (existing) c.existing = existing
  return c
}

async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }))
  return out
}

// ---- strudel.cc -----------------------------------------------------------

/** `strudel.cc/#<base64>` — plain base64 of the UTF-8 source. */
export function decodeStrudelFragment(fragment) {
  let raw = fragment
  try {
    raw = decodeURIComponent(fragment)
  }
  catch { /* keep as is */ }
  const cleaned = raw.replace(/-/g, '+').replace(/_/g, '/')
  if (!cleaned || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) throw new ResolveError('not-base64', 'the link fragment is not base64 — it does not carry code itself')
  const code = Buffer.from(cleaned, 'base64').toString('utf8')
  if (code.includes('�') || code.includes('\0')) throw new ResolveError('not-base64', 'the link fragment decodes to something that is not text')
  return code
}

const SUPABASE_URL = /https:\/\/[a-z0-9]+\.supabase\.co/
const JWT = /eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/

/**
 * `strudel.cc/?<hash>` — a short link holds only an id; the REPL reads the
 * code from the site's own store. The store URL and its public client key
 * are read from the live site's JavaScript at run time (never committed), so
 * a change on their side degrades to a clear "can't resolve".
 */
async function resolveShortLink(d, origin, hash) {
  const fail = why => new ResolveError('short-link-unavailable', `cannot resolve short link '${hash}': ${why}. Ask for the code to be pasted instead.`)
  let html
  try {
    html = (await getText(d, `${origin}/`)).text
  }
  catch (err) {
    throw fail(err.message)
  }
  // Any /_astro/*.js the page mentions (script tags, and the component-url
  // of the REPL's astro-island — which is where the REPL actually lives).
  const queue = [...new Set(html.match(/\/_astro\/[\w.@-]+\.js/g) ?? [])]
  const seen = new Set()
  let url, key
  for (let fetched = 0; queue.length && fetched < 30 && !(url && key); fetched++) {
    const path = queue.shift()
    if (seen.has(path)) continue
    seen.add(path)
    let text
    try {
      text = (await getText(d, `${origin}${path}`)).text
    }
    catch {
      continue
    }
    url ??= SUPABASE_URL.exec(text)?.[0]
    key ??= JWT.exec(text)?.[0]
    const base = path.replace(/[^/]+$/, '')
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'](\.\/[^"']+\.js)["']/g)) queue.push(base + m[1].slice(2))
  }
  if (!url || !key) throw fail("the site's store could not be located in its scripts")
  let rows
  try {
    rows = await getJson(d, `${url}/rest/v1/code_v1?select=code&hash=eq.${encodeURIComponent(hash)}`, { apikey: key, authorization: `Bearer ${key}` })
  }
  catch (err) {
    throw fail(err.message)
  }
  if (!Array.isArray(rows) || rows.length === 0 || typeof rows[0].code !== 'string') throw new ResolveError('not-found', `no code is stored for short link '${hash}'`)
  return rows[0].code
}

// ---- GitHub ---------------------------------------------------------------

const rawUrl = (owner, repo, branch, path) => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path.split('/').map(encodeURIComponent).join('/')}`
const blobUrl = (owner, repo, branch, path) => `https://github.com/${owner}/${repo}/blob/${branch}/${path}`

async function resolveRepo(d, lib, { owner, repo, branch, prefix }) {
  const notes = []
  if (!branch) {
    const info = await getJson(d, `https://api.github.com/repos/${owner}/${repo}`)
    branch = info.default_branch ?? 'main'
  }
  const tree = await getJson(d, `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`)
  if (tree.truncated) notes.push('the repository listing was truncated by GitHub; some files may be missing')
  const files = (tree.tree ?? []).filter((e) => {
    if (e.type !== 'blob' || !CODE_EXT.test(e.path)) return false
    if (prefix && !e.path.startsWith(`${prefix}/`) && e.path !== prefix) return false
    const parts = e.path.split('/')
    return !parts.some(p => p.startsWith('.') || SKIP_DIRS.has(p))
  })
  const skipped = []
  const usable = []
  for (const f of files) {
    if (typeof f.size === 'number' && f.size > MAX_FILE_BYTES) skipped.push({ path: f.path, reason: `larger than ${MAX_FILE_BYTES} bytes` })
    else usable.push(f)
  }
  if (usable.length > d.maxCandidates) {
    notes.push(`only the first ${d.maxCandidates} of ${usable.length} files were read`)
    usable.length = d.maxCandidates
  }
  const candidates = []
  await pool(usable, 8, async (f) => {
    let text
    try {
      text = (await getText(d, rawUrl(owner, repo, branch, f.path))).text
    }
    catch (err) {
      skipped.push({ path: f.path, reason: err.message })
      return
    }
    const why = notStrudelReason(text)
    if (why) {
      skipped.push({ path: f.path, reason: why })
      return
    }
    const c = makeCandidate(d, lib, { code: text, sourceUrl: blobUrl(owner, repo, branch, f.path), path: f.path })
    const dirs = f.path.split('/').slice(0, -1)
    if (dirs.some(p => HELPER_DIRS.has(p.toLowerCase()))) {
      c.helper = true
      c.notes.push('looks like a helper (lives in a functions/lib/helpers folder), not a standalone pattern')
    }
    if (/\bregister\s*\(/.test(text)) c.notes.push('defines its own functions with register()')
    candidates.push(c)
  })
  candidates.sort((a, b) => a.path.localeCompare(b.path))
  skipped.sort((a, b) => a.path.localeCompare(b.path))
  if (candidates.length === 0) throw new ResolveError('not-found', `no Strudel code files found in ${owner}/${repo}${prefix ? `/${prefix}` : ''}`)
  return { ok: true, candidates, skipped, notes }
}

async function resolveGist(d, lib, url) {
  const id = url.pathname.split('/').filter(Boolean).pop()
  const gist = await getJson(d, `https://api.github.com/gists/${id}`)
  const files = Object.values(gist.files ?? {}).filter(f => CODE_EXT.test(f.filename))
  if (files.length === 0) throw new ResolveError('not-found', 'the gist has no code files')
  const skipped = []
  const candidates = []
  for (const f of files) {
    const text = f.content ?? (await getText(d, f.raw_url)).text
    const why = notStrudelReason(text)
    if (why) {
      skipped.push({ path: f.filename, reason: why })
      continue
    }
    const sourceUrl = files.length === 1 ? `https://gist.github.com/${gist.owner?.login ? `${gist.owner.login}/` : ''}${id}` : `https://gist.github.com/${gist.owner?.login ? `${gist.owner.login}/` : ''}${id}#file-${f.filename.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    candidates.push(makeCandidate(d, lib, { code: text, sourceUrl, path: f.filename }))
  }
  if (candidates.length === 0) throw new ResolveError('not-strudel', skipped.map(s => `${s.path}: ${s.reason}`).join('; '))
  return { ok: true, candidates, skipped, notes: [] }
}

// ---- entry point ----------------------------------------------------------

function single(d, lib, code, sourceUrl, path) {
  const why = notStrudelReason(code)
  if (why) throw new ResolveError('not-strudel', `not Strudel code: ${why}`)
  return { ok: true, candidates: [makeCandidate(d, lib, { code, sourceUrl, path })], skipped: [], notes: [] }
}

/**
 * @param {string} source a URL, a file path, or '-' for stdin
 * @param {object} [deps] injected fetch / readFile / exists / stdin / library / sourceUrl
 */
export async function resolveSource(source, deps) {
  const d = defaults(deps)
  const lib = libraryEntries(d)
  try {
    if (source === '-') return single(d, lib, d.stdin(), d.sourceUrl)
    if (!/^https?:\/\//i.test(source)) {
      if (d.exists(source)) return single(d, lib, d.readFile(source), d.sourceUrl, source)
      throw new ResolveError('unsupported', `'${source}' is neither a URL nor a file that exists`)
    }

    const url = new URL(source)
    const host = url.hostname.replace(/^www\./, '')

    if (host === 'strudel.cc') {
      if (url.hash.length > 1) return single(d, lib, decodeStrudelFragment(url.hash.slice(1)), source)
      const hash = url.search.slice(1)
      if (/^[\w-]{6,}$/.test(hash)) return single(d, lib, await resolveShortLink(d, `${url.protocol}//${url.host}`, hash), source)
      throw new ResolveError('needs-reader', 'this is a strudel.cc page, not a pattern link — read the page for code blocks and pass them on')
    }

    if (host === 'github.com') {
      const [owner, repo, kind, branch, ...rest] = url.pathname.split('/').filter(Boolean)
      if (!owner || !repo) throw new ResolveError('unsupported', 'expected github.com/<owner>/<repo>[/tree/<branch>/<dir>] or a blob URL')
      if (kind === 'blob' && branch && rest.length) {
        const path = decodeURIComponent(rest.join('/'))
        const { text } = await getText(d, rawUrl(owner, repo, branch, path))
        return single(d, lib, text, source, path)
      }
      if (!kind || kind === 'tree') return await resolveRepo(d, lib, { owner, repo, branch, prefix: rest.length ? decodeURIComponent(rest.join('/')) : '' })
      throw new ResolveError('unsupported', `don't know how to read github.com/${owner}/${repo}/${kind}`)
    }

    if (host === 'gist.github.com') return await resolveGist(d, lib, url)

    const { text, contentType } = await getText(d, source)
    if (looksLikeHtml(text, contentType)) throw new ResolveError('needs-reader', 'this is a web page, not a code file — read it for code blocks and pass them on')
    return single(d, lib, text, source)
  }
  catch (err) {
    if (err instanceof ResolveError) return { ok: false, reason: err.reason, message: err.message }
    return { ok: false, reason: 'error', message: err.message }
  }
}
