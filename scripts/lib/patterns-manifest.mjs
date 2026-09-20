// Curated pattern manifest — parse, validate, and turn content/patterns/*.md
// into the SQL that reconciles PATTERNS_DB to it. Plain ESM, imported by
// both scripts/sync-patterns.mjs and vitest.config.ts.
//
// See openspec/changes/add-content-authoring/design.md (decisions 1, 3, 5)
// and content/patterns/README.md.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'

export const MANIFEST_DIR = 'content/patterns'

// Deterministic created_at for entries that don't set one. Existing rows
// keep their own created_at (the upsert never rewrites it). Base + index
// over the id-sorted manifest; base sits just after the original 0002
// seed range so an undated new pattern sorts newer than the starter set.
const CREATED_AT_BASE = Date.parse('2026-09-01T00:00:00.000Z')

export class ManifestError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`pattern manifest is invalid:\n  - ${problems.join('\n  - ')}`)
    this.name = 'ManifestError'
    this.problems = problems
  }
}

/**
 * @typedef {object} PatternEntry
 * @property {string} id
 * @property {string} title
 * @property {string} code
 * @property {string[]} tags
 * @property {string} sourceUrl
 * @property {string | null} sourceAuthor
 * @property {string} createdAt
 * @property {boolean} favorite
 */

function splitFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!m) return null
  return { frontmatter: m[1], body: m[2] }
}

/**
 * Normalise pattern code for storage and comparison: LF line endings, no
 * leading blank lines, no trailing whitespace. A first line's own
 * indentation is kept — the code is otherwise exactly as written.
 * @param {string} code
 */
export function normalizeCode(code) {
  return code.replace(/\r\n?/g, '\n').replace(/^(?:[ \t]*\n)+/, '').trimEnd()
}

/**
 * The fence to wrap `code` in: strictly longer than any run of backticks
 * inside it (minimum three), so code containing ``` is stored intact.
 * @param {string} code
 */
export function fenceFor(code) {
  const runs = (code.match(/`+/g) ?? []).map(r => r.length)
  return '`'.repeat(Math.max(3, ...runs.map(n => n + 1)))
}

const CODE_INFO = new Set(['', 'strudel', 'js', 'javascript'])

/**
 * The first fenced block whose info string is strudel/js/javascript or
 * empty. A block closes at a fence of at least the same length (CommonMark
 * rule), so a longer outer fence can hold ``` lines. Blocks with another
 * info string (e.g. ```text) are skipped whole.
 */
function extractCode(body) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = /^ {0,3}(`{3,})([^`]*)$/.exec(lines[i])
    if (!open) continue
    const closer = new RegExp(`^ {0,3}\`{${open[1].length},}[ \\t]*$`)
    let end = -1
    for (let j = i + 1; j < lines.length; j++) {
      if (closer.test(lines[j])) {
        end = j
        break
      }
    }
    if (end === -1) return '' // unclosed fence
    if (CODE_INFO.has(open[2].trim().toLowerCase())) {
      return normalizeCode(lines.slice(i + 1, end).join('\n'))
    }
    i = end // some other block — skip it entirely
  }
  return ''
}

/**
 * Read and parse every manifest file. Throws ManifestError listing every
 * problem found (never a partial result).
 * @param {string} [dir]
 * @returns {PatternEntry[]} sorted by id
 */
export function readManifest(dir = MANIFEST_DIR) {
  let files
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md')
  }
  catch (err) {
    throw new ManifestError([`cannot read ${dir}: ${err.message}`])
  }

  files.sort()
  const problems = []
  /** @type {PatternEntry[]} */
  const entries = []

  files.forEach((file, index) => {
    const id = file.replace(/\.md$/, '')
    const where = `${dir}/${file}`
    let raw
    try {
      raw = readFileSync(join(dir, file), 'utf8')
    }
    catch (err) {
      problems.push(`${where}: cannot read (${err.message})`)
      return
    }

    const split = splitFrontmatter(raw)
    if (!split) {
      problems.push(`${where}: missing YAML frontmatter (--- ... ---)`)
      return
    }

    let fm
    try {
      fm = parseYaml(split.frontmatter) ?? {}
    }
    catch (err) {
      problems.push(`${where}: frontmatter is not valid YAML (${err.message})`)
      return
    }

    const title = typeof fm.title === 'string' ? fm.title.trim() : ''
    const sourceUrl = typeof fm.source_url === 'string' ? fm.source_url.trim() : ''
    const code = extractCode(split.body)

    if (!title) problems.push(`${where}: 'title' is required and must be a non-empty string`)
    if (!sourceUrl) problems.push(`${where}: 'source_url' is required — a pattern is never imported without attribution`)
    if (!code) problems.push(`${where}: body must contain one fenced code block with the pattern code`)

    let tags = []
    if (fm.tags != null) {
      // YAML parses bare `303` / `808` as numbers — coerce, don't reject.
      if (!Array.isArray(fm.tags) || fm.tags.some(t => typeof t !== 'string' && typeof t !== 'number')) {
        problems.push(`${where}: 'tags' must be a list of strings`)
      }
      else {
        tags = fm.tags.map(t => String(t).trim()).filter(Boolean)
      }
    }

    let sourceAuthor = null
    if (fm.source_author != null) {
      if (typeof fm.source_author !== 'string') problems.push(`${where}: 'source_author' must be a string`)
      else sourceAuthor = fm.source_author.trim() || null
    }

    let createdAt = new Date(CREATED_AT_BASE + index * 1000).toISOString()
    if (fm.created_at != null) {
      const t = typeof fm.created_at === 'string' ? Date.parse(fm.created_at) : NaN
      if (Number.isNaN(t)) problems.push(`${where}: 'created_at' must be an ISO-8601 string`)
      else createdAt = new Date(t).toISOString()
    }

    let favorite = false
    if (fm.favorite != null) {
      if (typeof fm.favorite !== 'boolean') problems.push(`${where}: 'favorite' must be a boolean`)
      else favorite = fm.favorite
    }

    entries.push({ id, title, code, tags, sourceUrl, sourceAuthor, createdAt, favorite })
  })

  validateManifest(entries, problems)

  if (problems.length > 0) throw new ManifestError(problems)
  return entries
}

/**
 * Cross-entry checks. Appends to `problems` when given, else throws.
 * @param {PatternEntry[]} entries
 * @param {string[]} [problems]
 */
export function validateManifest(entries, problems) {
  const found = problems ?? []
  const seen = new Set()
  for (const e of entries) {
    if (seen.has(e.id)) found.push(`duplicate pattern id '${e.id}'`)
    seen.add(e.id)
  }
  if (!problems && found.length > 0) throw new ManifestError(found)
  return found
}

export function sq(value) {
  if (value == null) return 'NULL'
  const str = String(value)
  if (!str.includes('\n')) return `'${str.replace(/'/g, '\'\'')}'`
  // A multi-line pattern's code would otherwise embed a raw newline in
  // the generated SQL text. Both consumers of this output — D1's
  // `exec()` binding (used by the vitest test-DB seed) and, in
  // principle, any other line-oriented SQL runner — treat '\n' as the
  // separator between statements, so a literal newline here would
  // split one INSERT into unparseable fragments. A char(10)-concat
  // chain avoids that but hits SQLite's expression-tree depth limit on
  // a long pattern; a hex blob literal sidesteps newlines, quoting,
  // and depth entirely — it's just bytes, decoded back to text.
  const hex = Buffer.from(str, 'utf8').toString('hex')
  return `CAST(x'${hex}' AS TEXT)`
}

/**
 * SQL that brings the `origin='curated'` rows of PATTERNS_DB into exact
 * agreement with `entries`. Idempotent. Non-curated rows are untouched.
 * @param {PatternEntry[]} entries
 * @returns {string}
 */
export function toReconcileSql(entries) {
  const ids = entries.map(e => e.id)
  const idList = ids.length > 0 ? ids.map(sq).join(', ') : '\'\''
  const lines = []

  lines.push('-- generated by scripts/lib/patterns-manifest.mjs — do not edit by hand')

  for (const e of entries) {
    const favoriteValue = e.favorite ? 1 : 0
    lines.push(
      `INSERT INTO patterns (id, title, code, source_url, source_author, created_at, origin, favorite) VALUES (`
      + `${sq(e.id)}, ${sq(e.title)}, ${sq(e.code)}, ${sq(e.sourceUrl)}, ${sq(e.sourceAuthor)}, ${sq(e.createdAt)}, 'curated', ${favoriteValue})`
      + ` ON CONFLICT(id) DO UPDATE SET title=excluded.title, code=excluded.code, `
      + `source_url=excluded.source_url, source_author=excluded.source_author, origin='curated', favorite=excluded.favorite;`,
    )
  }

  // Rebuild tags for every manifest pattern.
  if (ids.length > 0) {
    lines.push(`DELETE FROM pattern_tags WHERE pattern_id IN (${idList});`)
    const tagRows = entries.flatMap(e => e.tags.map(t => `(${sq(e.id)}, ${sq(t)})`))
    if (tagRows.length > 0) {
      lines.push(`INSERT INTO pattern_tags (pattern_id, tag) VALUES ${tagRows.join(', ')};`)
    }
  }

  // Prune curated rows that fell out of the manifest.
  lines.push(
    `DELETE FROM pattern_tags WHERE pattern_id IN (SELECT id FROM patterns WHERE origin='curated' AND id NOT IN (${idList}));`,
  )
  lines.push(`DELETE FROM patterns WHERE origin='curated' AND id NOT IN (${idList});`)

  return `${lines.join('\n')}\n`
}

/** read + validate + generate, in one call. */
export function buildReconcileSql(dir = MANIFEST_DIR) {
  return toReconcileSql(readManifest(dir))
}
