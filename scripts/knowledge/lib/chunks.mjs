// Assembles the shared-schema chunks (add-strudel-knowledge-corpus tasks
// 5.1-5.3) from the JSDoc doclets (lib/jsdoc.mjs), the category map and
// concept/example candidates (lib/pages.mjs). See design.md decisions 5
// (category from pages, tags from `@tags`) and 8 (the schema and id
// scheme). This module does no I/O and no network — it's a pure
// transform, so it's fully unit-testable.

import { slugify } from '../../patterns/write.mjs'

const LICENSE = 'AGPL-3.0'
const REPO_BLOB_BASE = 'https://codeberg.org/uzu/strudel/src/commit'

function sourceUrl(commit, path) {
  return `${REPO_BLOB_BASE}/${commit}/${path}`
}

/**
 * @param {ReturnType<typeof import('./jsdoc.mjs').extractDoclets> extends Promise<infer T> ? T : never} doclets
 * @param {Map<string,string>} categoryByFunction from pages.mjs's buildCategoryMap
 * @param {{ commit: string }} version
 * @returns {{ chunks: object[], gaps: string[], collisions: string[] }}
 */
export function buildFunctionChunks(doclets, categoryByFunction, { commit }) {
  const chunks = []
  const gaps = []
  const collisions = []
  const seenIds = new Set()

  for (const d of doclets) {
    const id = d.name
    if (seenIds.has(id)) {
      collisions.push(`duplicate function id "${id}" (from ${d.sourcePath ?? 'unknown source'}) — kept the first, dropped this one`)
      continue
    }
    seenIds.add(id)

    let category = categoryByFunction.get(d.name) ?? categoryByFunction.get(d.longname)
    if (!category) {
      category = d.memberof ? slugify(d.memberof) : (d.sourcePath ? slugify(d.sourcePath) : 'uncategorized')
      gaps.push(`${d.name}: not presented on any documentation page — category derived from source (${category})`)
    }

    chunks.push({
      id,
      kind: 'function',
      title: d.name,
      category,
      tags: d.tags,
      text: d.description,
      sourceUrl: d.sourcePath ? sourceUrl(commit, d.sourcePath) : null,
      license: LICENSE,
      version: commit,
      synonyms: d.synonyms,
      params: d.params,
      examples: d.examples,
    })
  }

  return { chunks, gaps, collisions }
}

/**
 * @param {Array<{path: string, parsed: ReturnType<typeof import('./pages.mjs').parsePage>}>} pages
 * @param {{ commit: string }} version
 * @returns {{ chunks: object[], collisions: string[] }}
 */
export function buildConceptAndExampleChunks(pages, { commit }) {
  const chunks = []
  const collisions = []
  const seenIds = new Set()

  const add = (id, chunk) => {
    if (seenIds.has(id)) {
      collisions.push(`duplicate id "${id}" (${chunk.sourceUrl}) — kept the first, dropped this one`)
      return
    }
    seenIds.add(id)
    chunks.push({ id, ...chunk })
  }

  for (const { path, parsed } of pages) {
    const pageSlug = slugify(path.replace(/\.mdx?$/, ''))
    for (const c of parsed.concepts) {
      const id = `${pageSlug}-${slugify(c.heading)}`
      add(id, {
        kind: 'concept',
        title: c.heading,
        category: c.category,
        tags: [],
        text: c.text,
        sourceUrl: sourceUrl(commit, `website/src/pages/${path}`),
        license: LICENSE,
        version: commit,
      })
    }
    for (const e of parsed.examples) {
      const id = `${pageSlug}-${slugify(e.heading)}-example-${e.index}`
      add(id, {
        kind: 'example',
        title: `${e.heading} example`,
        category: e.category,
        tags: [],
        text: e.code,
        sourceUrl: sourceUrl(commit, `website/src/pages/${path}`),
        license: LICENSE,
        version: commit,
      })
    }
  }

  return { chunks, collisions }
}

/**
 * Combines function and concept/example chunks into one corpus, checking
 * for an id collision across the two pools too (unlikely, but a chunk's
 * id must be unique regardless of which pool produced it).
 */
export function assembleCorpus(functionResult, conceptResult) {
  const chunks = []
  const collisions = [...functionResult.collisions, ...conceptResult.collisions]
  const seenIds = new Set()

  for (const chunk of [...functionResult.chunks, ...conceptResult.chunks]) {
    if (seenIds.has(chunk.id)) {
      collisions.push(`duplicate id "${chunk.id}" across chunk kinds — kept the first, dropped this one`)
      continue
    }
    seenIds.add(chunk.id)
    chunks.push(chunk)
  }

  return { chunks, gaps: functionResult.gaps, collisions }
}
