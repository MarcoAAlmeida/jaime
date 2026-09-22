import { readdirSync as fsReaddirSync } from 'node:fs'

// Parses a documentation page from the submodule's website into category
// associations, concept chunks, and example chunks — with small, targeted
// regexes rather than a full MDX/Astro parser (add-strudel-knowledge-corpus
// tasks 4.1-4.3; see design.md decision 4 for why, and decision 5 for how
// category/tags are split between page structure and each function's own
// `@tags`).

// The five English documentation sections, in a fixed order — this order,
// not filesystem order, is what makes "first page wins" (buildCategoryMap)
// deterministic. `de/` (German translations) is never included.
export const PAGE_DIRECTORIES = ['learn', 'recipes', 'understand', 'technical-manual', 'workshop', 'functions']

const HEADING = /^(#{1,3})\s+(.+?)\s*$/gm
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const IMPORT_LINE = /^import\s.+$/gm
const JSDOC_TAG = /<JsDoc\b[^>]*\/>/g
const JSDOC_NAME = /name=["']([^"']+)["']/
const MINI_REPL = /<MiniRepl\b[^>]*\btune=\{(`[\s\S]*?`|"[^"]*"|'[^']*')\}[^>]*\/>/g
const FENCED_CODE = /```[a-zA-Z]*\n([\s\S]*?)```/g
const LEFTOVER_TAG = /<[A-Za-z][^>]*\/?>/g

function unquote(raw) {
  return raw.slice(1, -1)
}

function slugTitleFromPath(filePath) {
  const base = filePath.replace(/\.mdx?$/, '').split(/[/\\]/).pop()
  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function splitFrontmatter(text) {
  const m = FRONTMATTER.exec(text)
  if (!m) return { title: null, body: text }
  const titleMatch = /^title:\s*(.+?)\s*$/m.exec(m[1])
  return { title: titleMatch ? titleMatch[1].replace(/^["']|["']$/g, '') : null, body: text.slice(m[0].length) }
}

function splitSections(body) {
  const headings = [...body.matchAll(HEADING)]
  const sections = []
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i][0].length
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length
    sections.push({ heading: headings[i][2], level: headings[i][1].length, text: body.slice(start, end) })
  }
  return sections
}

/**
 * @param {string} filePath used only for warnings and the fallback title
 * @param {string} mdxText
 * @returns {{ title: string, associations: Array<{functionName:string, category:string}>,
 *             concepts: Array<{heading:string, category:string, text:string}>,
 *             examples: Array<{heading:string, category:string, code:string, index:number}>,
 *             warnings: string[] }}
 */
export function parsePage(filePath, mdxText) {
  const warnings = []
  // The real pages are CRLF (verified against the submodule, 2026-09-22)
  // — every regex below assumes bare \n, so normalize once up front
  // rather than special-casing line endings throughout.
  const normalized = mdxText.replace(/\r\n/g, '\n')
  const { title: frontmatterTitle, body: withoutFrontmatter } = splitFrontmatter(normalized)
  const title = frontmatterTitle ?? (warnings.push(`${filePath}: no frontmatter title — falling back to a filename-derived one`), slugTitleFromPath(filePath))
  const body = withoutFrontmatter.replace(IMPORT_LINE, '')

  const associations = []
  const concepts = []
  const examples = []

  for (const section of splitSections(body)) {
    const jsdocTags = [...section.text.matchAll(JSDOC_TAG)]
    if (jsdocTags.length > 0) {
      for (const tag of jsdocTags) {
        const nameMatch = JSDOC_NAME.exec(tag[0])
        if (nameMatch) associations.push({ functionName: nameMatch[1], category: title })
        else warnings.push(`${filePath}: <JsDoc> tag with no "name" attribute in section "${section.heading}" — skipped`)
      }
      continue // a function-reference section, never also a concept (design.md decision 4)
    }

    let exampleIndex = 0
    let prose = section.text

    prose = prose.replace(MINI_REPL, (whole, quoted) => {
      examples.push({ heading: section.heading, category: title, code: unquote(quoted), index: exampleIndex++ })
      return ''
    })
    for (const m of section.text.matchAll(FENCED_CODE)) {
      examples.push({ heading: section.heading, category: title, code: m[1].trim(), index: exampleIndex++ })
    }
    prose = prose.replace(LEFTOVER_TAG, '').trim()

    if (prose) concepts.push({ heading: section.heading, category: title, text: prose })
  }

  return { title, associations, concepts, examples, warnings }
}

/**
 * Every `*.mdx` under the fixed English documentation directories, in a
 * fixed, deterministic order (`PAGE_DIRECTORIES`, then filename). `de/`
 * (or any directory not in that list) is never visited.
 *
 * @param {string} pagesRoot the `website/src/pages` directory (or a fixture standing in for it)
 * @param {{ readdirSync?: (dir: string) => string[] }} [options]
 * @returns {string[]} paths, relative to `pagesRoot`, e.g. "learn/mini-notation.mdx"
 */
export function listPages(pagesRoot, { readdirSync } = {}) {
  const readDir = (dir) => {
    try {
      return (readdirSync ?? fsReaddirSync)(dir)
    }
    catch {
      return [] // the directory doesn't exist for this page set — not an error
    }
  }
  const paths = []
  for (const dirName of PAGE_DIRECTORIES) {
    const dirPath = `${pagesRoot}/${dirName}`
    const files = readDir(dirPath).filter(f => f.endsWith('.mdx')).sort()
    for (const f of files) paths.push(`${dirName}/${f}`)
  }
  return paths
}

/**
 * function name → category, first page in `pages`'s order wins. A repeat
 * is logged via `warnings`, never thrown — a function documented on two
 * pages is unusual, not invalid.
 *
 * @param {Array<{path: string, parsed: ReturnType<typeof parsePage>}>} pages in the order `listPages` returned
 * @returns {{ categoryByFunction: Map<string,string>, warnings: string[] }}
 */
export function buildCategoryMap(pages) {
  const categoryByFunction = new Map()
  const warnings = []
  for (const { path, parsed } of pages) {
    for (const { functionName, category } of parsed.associations) {
      if (categoryByFunction.has(functionName)) {
        warnings.push(`${functionName}: already categorized as "${categoryByFunction.get(functionName)}" — ${path}'s "${category}" ignored`)
        continue
      }
      categoryByFunction.set(functionName, category)
    }
  }
  return { categoryByFunction, warnings }
}
