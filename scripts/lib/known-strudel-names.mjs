// The set of names the Strudel docs index knows — every function chunk's
// title plus its documented synonyms — built from the committed corpus
// (content/knowledge/strudel.json). Feeds `unknownNames` from
// shared/strudel (add-strudel-code-analysis design.md Decision 7); the
// shared module never loads the corpus itself.

import { readFileSync } from 'node:fs'

const DEFAULT_CORPUS_PATH = 'content/knowledge/strudel.json'

/**
 * @param {{ kind: string, title: string, synonyms?: string[] }[]} chunks the corpus file's `chunks` array
 * @returns {Set<string>}
 */
export function knownNamesFromChunks(chunks) {
  const names = new Set()
  for (const c of chunks) {
    if (c.kind !== 'function') continue
    names.add(c.title)
    for (const s of c.synonyms ?? []) names.add(s)
  }
  return names
}

/** @param {string} [path] @returns {Set<string>} */
export function readKnownStrudelNames(path = DEFAULT_CORPUS_PATH) {
  return knownNamesFromChunks(JSON.parse(readFileSync(path, 'utf8')).chunks)
}
