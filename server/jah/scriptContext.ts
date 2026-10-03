// Bounds the room's script and the asker's own selection sent to @jah
// (add-jah-script-context, design.md decisions 3-4): small, deliberate
// caps, tunable via these two constants. Pure function, no I/O — like
// server/jah/retrieval.ts's own chunk-formatting helpers.

import type { ScriptContext } from './prompt'

export const MAX_SCRIPT_CHARS = 4000
export const MAX_SELECTION_CHARS = 2000

/**
 * @param fullScript the room's current script, read fresh from `room.ydoc` — never trusted from the client
 * @param selectionText the asker's own current selection, if any (`undefined` for none)
 */
export function buildScriptContext(fullScript: string, selectionText: string | undefined): ScriptContext {
  const selection = selectionText && selectionText.length > 0
    ? selectionText.slice(0, MAX_SELECTION_CHARS)
    : undefined

  if (fullScript.length <= MAX_SCRIPT_CHARS) {
    return { script: fullScript, selection, truncated: false }
  }

  // Oversized: prefer the selection plus the script content nearest to
  // it over the full script — only meaningful if the (already-trimmed)
  // selection text still appears verbatim in the current script; a
  // selection that doesn't (the document changed since selecting) falls
  // back to the same head-of-script truncation as having no selection.
  if (selection) {
    const index = fullScript.indexOf(selection)
    if (index !== -1) {
      const budget = MAX_SCRIPT_CHARS - selection.length
      const before = Math.floor(budget / 2)
      const after = budget - before
      const start = Math.max(0, index - before)
      const end = Math.min(fullScript.length, index + selection.length + after)
      return { script: fullScript.slice(start, end), selection, truncated: true }
    }
  }

  return { script: fullScript.slice(0, MAX_SCRIPT_CHARS), selection, truncated: true }
}
