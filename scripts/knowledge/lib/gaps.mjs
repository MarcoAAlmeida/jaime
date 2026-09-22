// Passes the submodule's own undocumented-exports record through into the
// run's report, unchanged in meaning (add-strudel-knowledge-corpus task
// 7.1; spec: "Documented Gaps Are Reported, Not Hidden"). This repo does
// not recompute what jsdoc failed to document — Strudel's own
// `report-undocumented` script already produced `undocumented.json`;
// disagreeing with its own accounting would help no one.

import { readFileSync } from 'node:fs'

/** `{ "path/to/file.mjs": ["name1", "name2"] }` → one readable line per undocumented export. */
export function formatUndocumentedGaps(undocumented) {
  const gaps = []
  for (const [path, names] of Object.entries(undocumented)) {
    for (const name of names) gaps.push(`${path}: ${name} (undocumented — no JSDoc at all)`)
  }
  return gaps
}

/**
 * @param {string} undocumentedJsonPath the submodule's own `undocumented.json`
 * @param {{ readFile?: typeof readFileSync }} [options]
 */
export function loadUndocumentedGaps(undocumentedJsonPath, { readFile = readFileSync } = {}) {
  const raw = JSON.parse(readFile(undocumentedJsonPath, 'utf8'))
  return formatUndocumentedGaps(raw)
}
