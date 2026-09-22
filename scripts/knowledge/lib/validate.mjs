// Validates every example two ways (add-strudel-knowledge-corpus tasks
// 6.1-6.4; see design.md decision 6): does it evaluate at all (the same
// headless check `pattern:check --fast` uses), and — for documented
// function examples — does it produce exactly what Strudel's own test
// suite recorded for it. Both are reported, never silently dropped.

// Verbatim from refers_to/strudel/test/examples.test.mjs's own
// `skippedExamples` — names its Node test runtime can't evaluate either
// (device motion/orientation, gamepad, a couple of others), so there is
// no snapshot entry to compare against. Copied in rather than read from
// the submodule at validation time, so this module's own tests don't need
// it present; a drift between this list and Strudel's real one is a
// documentation detail worth noticing, not a load-bearing contract.
export const STRUDEL_SKIPPED_EXAMPLES = [
  'absoluteOrientationGamma', 'absoluteOrientationBeta', 'absoluteOrientationAlpha',
  'orientationGamma', 'orientationBeta', 'orientationAlpha',
  'rotationGamma', 'rotationBeta', 'rotationAlpha',
  'gravityZ', 'gravityY', 'gravityX',
  'accelerationZ', 'accelerationY', 'accelerationX',
  'defaultmidimap', 'midimaps', 'clearScope', 'bmod',
]

// Matches refers_to/strudel/test/__snapshots__/examples.test.mjs.snap's
// entries: `exports[`runs examples > example "NAME" example index N M`] =
// `VALUE`;` — the trailing ` M` is vitest's own per-assertion counter, not
// part of the semantic key.
const SNAPSHOT_ENTRY = /exports\[`runs examples > (?<key>example "(?<name>[^"]+)" example index (?<index>\d+)) \d+`\] = `(?<value>[\s\S]*?)`;/g

/** Parses Strudel's snapshot file text into `Map<"example \"name\" example index N", string[]>`. */
export function parseStrudelSnapshot(text) {
  const map = new Map()
  for (const m of text.matchAll(SNAPSHOT_ENTRY)) {
    const { key, value } = m.groups
    try {
      map.set(key, JSON.parse(value.replace(/,(\s*[\]}])/g, '$1')))
    }
    catch {
      // A snapshot entry we can't parse is Strudel's own file being oddly
      // shaped, not something for us to fix — it's simply unavailable for
      // comparison, the same as a name on the skip list.
    }
  }
  return map
}

/** Every `{ code, index }` this chunk's kind actually carries code for — concept chunks have none. */
function codeSamplesOf(chunk) {
  if (chunk.kind === 'function') return chunk.examples.map((code, index) => ({ code, index }))
  if (chunk.kind === 'example') return [{ code: chunk.text, index: 0 }]
  return []
}

/**
 * Evaluates every code sample a chunk carries with the same headless
 * evaluator `pattern:check --fast` uses. Returns one report entry per
 * sample that did NOT pass cleanly — `[]` when everything passed.
 *
 * @param {object} chunk
 * @param {{ check: (code: string) => Promise<{status: string, error?: string, missing?: string[]}> }} triage
 */
export async function checkPlayability(chunk, triage) {
  const entries = []
  for (const { code, index } of codeSamplesOf(chunk)) {
    // Sequential on purpose: triage mutates a shared global, one check at a time.
    const result = await triage.check(code)
    if (result.status === 'pass') continue
    if (result.status === 'inconclusive') {
      entries.push({ chunkId: chunk.id, exampleIndex: index, issue: 'inconclusive', detail: 'no events in the cycles examined — it may still play in the browser' })
    }
    else if (result.status === 'missing-sounds') {
      entries.push({ chunkId: chunk.id, exampleIndex: index, issue: 'missing-sounds', detail: result.missing.join(', ') })
    }
    else {
      entries.push({ chunkId: chunk.id, exampleIndex: index, issue: 'error', detail: result.error })
    }
  }
  return entries
}

/**
 * Compares a single function-chunk example against Strudel's own recorded
 * output for it, re-evaluating it the same way Strudel's own test does
 * (`queryFn` is expected to run 4 cycles and format each hap with
 * `.show(true)`, matching `refers_to/strudel/test/runtime.mjs`'s
 * `queryCode`). Returns `null` when it matches, when the function is on
 * the skip list (Strudel has no ground truth for it either), or when this
 * chunk isn't a function's own example (concept/example chunks have no
 * corresponding Strudel snapshot).
 *
 * @param {object} chunk
 * @param {number} exampleIndex
 * @param {Map<string,string[]>} snapshotMap from parseStrudelSnapshot
 * @param {(code: string) => Promise<string[]>} queryFn
 */
export async function checkAgainstStrudelSnapshot(chunk, exampleIndex, snapshotMap, queryFn) {
  if (chunk.kind !== 'function') return null
  if (STRUDEL_SKIPPED_EXAMPLES.includes(chunk.title)) return null

  const key = `example "${chunk.title}" example index ${exampleIndex}`
  const expected = snapshotMap.get(key)
  if (!expected) return { chunkId: chunk.id, exampleIndex, issue: 'no-snapshot-entry', detail: `no recorded output for ${key}` }

  let actual
  try {
    actual = await queryFn(chunk.examples[exampleIndex])
  }
  catch (err) {
    return { chunkId: chunk.id, exampleIndex, issue: 'error', detail: String(err?.message ?? err) }
  }

  if (JSON.stringify(actual) === JSON.stringify(expected)) return null
  return { chunkId: chunk.id, exampleIndex, issue: 'mismatch', detail: { expected, actual } }
}

/**
 * Runs both checks over the whole corpus and returns one flat
 * `validation[]` list — every entry names the chunk, the example, and the
 * specific issue (spec: "reported by the example's name and location").
 * `queryFn` is optional; when omitted, only playability (not the exact
 * Strudel-snapshot comparison) is checked — a chunk is still fully valid
 * without it, since playability is the primary signal (design.md decision 6).
 *
 * @param {object[]} chunks
 * @param {{ triage: object, snapshotText?: string, queryFn?: (code: string) => Promise<string[]> }} options
 */
export async function validateCorpus(chunks, { triage, snapshotText, queryFn }) {
  const snapshotMap = snapshotText ? parseStrudelSnapshot(snapshotText) : null
  const entries = []

  for (const chunk of chunks) {
    // Sequential, same reason as checkPlayability.
    entries.push(...await checkPlayability(chunk, triage))

    if (snapshotMap && queryFn && chunk.kind === 'function') {
      for (let i = 0; i < chunk.examples.length; i++) {
        const entry = await checkAgainstStrudelSnapshot(chunk, i, snapshotMap, queryFn)
        if (entry) entries.push(entry)
      }
    }
  }
  return entries
}
