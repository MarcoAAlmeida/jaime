// Loads and validates the committed case set (add-jah-eval-harness task 2.1).
// Cases live in ../cases/{docs,fix,compose}.mjs, each exporting a default
// array. Nothing here calls a model or evaluates code — see score.mjs and
// the evaluation adapter for that.

import { createHash } from 'node:crypto'
import { docsCases } from '../cases/docs.mjs'
import { fixCases } from '../cases/fix.mjs'
import { composeCases } from '../cases/compose.mjs'

export const KINDS = ['docs', 'fix', 'compose']

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Every problem found with `set`, or [] if it is well-formed. Checks the whole set, not just the first bad case. */
export function validateCaseSet(set) {
  const problems = []
  const seenIds = new Map()

  for (const [i, c] of set.entries()) {
    const where = c && typeof c.id === 'string' ? `case "${c.id}"` : `case at index ${i}`

    if (!c || typeof c !== 'object') { problems.push(`${where}: not an object`); continue }
    if (typeof c.id !== 'string' || !c.id) problems.push(`${where}: missing "id"`)
    else if (!KEBAB.test(c.id)) problems.push(`${where}: id "${c.id}" is not kebab-case`)
    // `message` is the request a user would type. A fix case may omit it —
    // renderMessage() supplies a default — everything else must have one.
    if (c.message !== undefined && (typeof c.message !== 'string' || !c.message.trim())) problems.push(`${where}: "message" must be a non-empty string when present`)
    if (c.kind !== 'fix' && (typeof c.message !== 'string' || !c.message.trim())) problems.push(`${where}: missing "message"`)
    if (!KINDS.includes(c.kind)) { problems.push(`${where}: unknown kind "${c.kind}" (expected one of ${KINDS.join(', ')})`); continue }

    if (c.kind === 'docs') {
      if (!Array.isArray(c.expect) || c.expect.length === 0) problems.push(`${where}: "expect" must be a non-empty array of function names`)
      if (c.forbid !== undefined && !Array.isArray(c.forbid)) problems.push(`${where}: "forbid" must be an array when present`)
      if (c.code !== undefined && !['required', 'optional'].includes(c.code)) problems.push(`${where}: "code" must be "required" or "optional"`)
    }
    else if (c.kind === 'fix') {
      if (typeof c.broken !== 'string' || !c.broken.trim()) problems.push(`${where}: missing "broken" code`)
      if (typeof c.error !== 'string' || !c.error.trim()) problems.push(`${where}: missing "error"`)
      if (c.keep !== undefined && !Array.isArray(c.keep)) problems.push(`${where}: "keep" must be an array when present`)
    }
    else if (c.kind === 'compose') {
      if (c.mustUse !== undefined && !Array.isArray(c.mustUse)) problems.push(`${where}: "mustUse" must be an array when present`)
      if (c.mustNotUse !== undefined && !Array.isArray(c.mustNotUse)) problems.push(`${where}: "mustNotUse" must be an array when present`)
      if (c.minEvents !== undefined && !(Number.isInteger(c.minEvents) && c.minEvents >= 1)) problems.push(`${where}: "minEvents" must be a positive integer when present`)
    }

    if (typeof c.id === 'string' && c.id) {
      if (seenIds.has(c.id)) problems.push(`duplicate id "${c.id}" (cases at index ${seenIds.get(c.id)} and ${i})`)
      else seenIds.set(c.id, i)
    }
  }

  return problems
}

/** A stable string form of `set` used for the fingerprint: sorted by id, keys sorted. */
function canonical(set) {
  const sortKeys = value =>
    Array.isArray(value)
      ? value.map(sortKeys)
      : (value && typeof value === 'object')
          ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])]))
          : value
  const sorted = [...set].sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0))
  return JSON.stringify(sorted.map(sortKeys))
}

/** Short sha-256 of the case set's canonical form — changes whenever a case's content changes. */
export function fingerprintCaseSet(set) {
  return createHash('sha256').update(canonical(set)).digest('hex').slice(0, 12)
}

/**
 * The full case set, plus every validation problem (empty when the set is
 * well-formed). Never throws — callers decide whether to proceed.
 */
export function loadCaseSet() {
  const set = [...docsCases, ...fixCases, ...composeCases]
  return { cases: set, problems: validateCaseSet(set), fingerprint: fingerprintCaseSet(set) }
}

const DEFAULT_FIX_MESSAGE = 'This won\'t run — can you fix it?'

/**
 * The text a user would actually send `@jah` for `c` (task 2.2). Docs and
 * compose cases send their `message` as-is; a fix case sends its `message`
 * (or the default) followed by the error and the broken code, the way a
 * user pastes a failure today.
 */
export function renderMessage(c) {
  if (c.kind !== 'fix') return c.message
  const intro = c.message ?? DEFAULT_FIX_MESSAGE
  return `${intro}\n\nError: ${c.error}\n\n\`\`\`strudel\n${c.broken}\n\`\`\``
}
