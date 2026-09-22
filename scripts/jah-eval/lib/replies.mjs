// Reply-parsing helpers shared by the eval harness (run.mjs) and the older
// prompt-variant comparison (../jah-prompt-eval.mjs). Moved here unchanged
// from that script (add-jah-eval-harness task 1.1) so both tools score
// formatting the same way; jah-prompt-eval.mjs now imports from here instead
// of carrying its own copies.

/** Real sample packs a pattern may load with `samples('github:...')`. */
export const REAL_PACKS = ['yaxu/clean-breaks', 'tidalcycles/dirt-samples']
/** Sounds the app does not load by default (see app/lib/prebake.ts). */
export const UNLOADED_SOUNDS = /\b(amen|amen_\w*|jungle|breaks?\d*)\b/i

/** Every fenced code block in `text`, as `{ label, code }` (label lower-cased, trimmed). */
export function fences(text) {
  const out = []
  const re = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g
  for (let m = re.exec(text); m; m = re.exec(text)) out.push({ label: m[1].trim().toLowerCase(), code: m[2] })
  return out
}

/** Whether `code`'s brackets and quotes are balanced (no unterminated string, no mismatch). */
export function balanced(code) {
  const pairs = { ')': '(', ']': '[', '}': '{' }
  const stack = []
  let quote = null
  for (const ch of code) {
    if (quote) { if (ch === quote) quote = null; continue }
    if (ch === '"' || ch === '\'' || ch === '`') quote = ch
    else if ('([{'.includes(ch)) stack.push(ch)
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false
  }
  return !quote && stack.length === 0
}

/** The exact "recoverable" predicate scripts/jah-prompt-eval.mjs has always used. */
function isRecoverable(f) {
  return ['strudel', 'js', 'javascript', ''].includes(f.label)
    || /^\s*(strudel|js|javascript)\s*\n/.test(f.code)
}

/**
 * The block a reply's code is judged by (new — the eval harness's own need,
 * not part of the older script): the first fence labelled `strudel` with
 * non-empty, bracket-balanced code; else the first recoverable fence with
 * non-empty code, with a leading `strudel`/`js`/`javascript` label line
 * (some models put it there instead of on the fence line) stripped; else
 * null (no code).
 */
export function primaryBlock(text) {
  const fs = fences(text)
  const labelled = fs.find(f => f.label === 'strudel' && f.code.trim() && balanced(f.code))
  if (labelled) return labelled.code
  const recoverable = fs.find(f => isRecoverable(f) && f.code.trim())
  if (!recoverable) return null
  const m = /^\s*(strudel|js|javascript)\s*\n([\s\S]*)$/.exec(recoverable.code)
  return m ? m[2] : recoverable.code
}

/** Formatting measures scripts/jah-prompt-eval.mjs has always reported. */
export function score(text) {
  const fs = fences(text)
  const labelled = fs.filter(f => f.label === 'strudel' && f.code.trim() && balanced(f.code))
  const recoverable = fs.filter(isRecoverable)
  const codeAll = fs.map(f => f.code).join('\n')
  return {
    fenced: fs.length > 0,
    strudel: labelled.length > 0,
    recoverable: recoverable.length > 0,
    silent: UNLOADED_SOUNDS.test(codeAll) && !/samples\s*\(/.test(codeAll),
    invented: [...codeAll.matchAll(/samples\(\s*['"]github:([^/'"]+\/[^/'"]+)/g)]
      .some(m => !REAL_PACKS.includes(m[1])),
  }
}
