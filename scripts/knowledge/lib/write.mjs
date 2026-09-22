// Serializes and writes the committed corpus deterministically
// (add-strudel-knowledge-corpus task 7.2; design.md decision 8): the same
// input always produces the same bytes, so re-running `knowledge:refresh`
// against an unchanged submodule is a no-op diff, and a real diff always
// means something really changed — the same guarantee
// scripts/patterns/write.mjs already makes for pattern files.

import { writeFileSync } from 'node:fs'

// Only the keys present on a given chunk are kept — a concept/example
// chunk simply has none of the function-only ones — but whichever are
// present always come out in this order.
const CHUNK_KEY_ORDER = [
  'id', 'kind', 'title', 'category', 'tags', 'text',
  'sourceUrl', 'license', 'version', 'synonyms', 'params', 'examples',
]
const REPORT_KEY_ORDER = ['generatedAt', 'submoduleCommit', 'strudelVersions', 'chunks', 'gaps', 'validation']

function ordered(obj, keyOrder) {
  const out = {}
  for (const key of keyOrder) if (key in obj) out[key] = obj[key]
  return out
}

function compareChunks(a, b) {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * @param {{ generatedAt: string, submoduleCommit: string, strudelVersions: object,
 *           chunks: object[], gaps: string[], validation: object[] }} report
 * @returns {string} pretty-printed JSON, stable key order, sorted chunks, trailing newline
 */
export function serializeCorpus(report) {
  const sortedChunks = [...report.chunks].sort(compareChunks).map(c => ordered(c, CHUNK_KEY_ORDER))
  const orderedReport = ordered({ ...report, chunks: sortedChunks }, REPORT_KEY_ORDER)
  return `${JSON.stringify(orderedReport, null, 2)}\n`
}

/**
 * @param {string} path
 * @param {ReturnType<typeof serializeCorpus> | Parameters<typeof serializeCorpus>[0]} data pre-serialized text, or a report to serialize
 * @param {{ writeFile?: typeof writeFileSync }} [options]
 */
export function writeCorpus(path, data, { writeFile = writeFileSync } = {}) {
  const text = typeof data === 'string' ? data : serializeCorpus(data)
  writeFile(path, text)
}
