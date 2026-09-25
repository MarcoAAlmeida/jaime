// Model-free scoring (add-jah-eval-harness task 3.2): a pure function of a
// case, the model's reply text and the outcome of evaluating its code.
// Never calls a model or the network — see model.mjs and the evaluation
// adapter (evaluate.mjs) for the pieces that do, which the runner (run.mjs)
// wires together before calling this.

import { primaryBlock, score as formattingScore } from './replies.mjs'

/** Whole-word, case-insensitive match, tolerant of a leading `.` (method calls) or trailing `()`. */
function mentions(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-zA-Z0-9_])\\.?${escaped}(?:\\(|\\b)`, 'i').test(text)
}

/** `keep`/`mustUse` fragments are matched as exact substrings once whitespace runs are collapsed. */
function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim()
}

/**
 * A requirement in `expect`/`mustUse` is normally one name that must be
 * present; wrapping alternatives in a nested array (e.g. `['lpf', 'cutoff']`
 * inside the outer list) instead means "at least one of these" — for a
 * real Strudel synonym (`cutoff` for `lpf`) or an equally valid different
 * function (`chord`+`voicing` vs `note` for a chord progression), where
 * requiring one specific name would fail a genuinely correct answer.
 */
function satisfies(text, requirement, matcher) {
  const alternatives = Array.isArray(requirement) ? requirement : [requirement]
  return alternatives.some(name => matcher(text, name))
}

/** For a `missing` report: a plain requirement prints as itself, an alternatives group as "a or b". */
function describeRequirement(requirement) {
  return Array.isArray(requirement) ? requirement.join(' or ') : requirement
}

function containsFragment(code, fragment) {
  return collapseWhitespace(code).includes(collapseWhitespace(fragment))
}

/**
 * The function-existence check (task 3.1's seam consumed here). While no
 * documentation index exists, this is always `{ result: 'unavailable' }` —
 * see functions.mjs. `extractCalledFunctions` is left undefined until a
 * phase that needs it supplies one; inventing extraction ahead of that need
 * would be throwaway work (see design.md decision 7).
 */
function functionExistenceCheck(functionIndex, code, extractCalledFunctions) {
  if (!functionIndex.available) return { result: 'unavailable', reason: functionIndex.reason }
  if (!extractCalledFunctions) return { result: 'unavailable', reason: 'no call-extraction available yet' }
  const missing = extractCalledFunctions(code).filter(name => !functionIndex.has(name))
  return missing.length > 0 ? { result: 'fail', missing } : { result: 'pass' }
}

/**
 * @param {object} c a case from cases.mjs
 * @param {string} reply the model's raw reply text
 * @param {{verdict:'pass'|'fail'|'inconclusive'|'no-code', error?:string, missing?:string[], events?:number}} evalOutcome
 * @param {{available:boolean, reason?:string, has?:(name:string)=>boolean}} functionIndex from functions.mjs
 * @param {(code:string)=>string[]} [extractCalledFunctions]
 */
export function score(c, reply, evalOutcome, functionIndex, extractCalledFunctions) {
  const code = primaryBlock(reply)
  const formatting = formattingScore(reply)
  const checks = {}
  checks.functionExistence = functionExistenceCheck(functionIndex, code ?? '', extractCalledFunctions)

  if (c.kind === 'docs') {
    const missingExpect = c.expect.filter(req => !satisfies(reply, req, mentions))
    checks.expect = missingExpect.length === 0 ? { result: 'pass' } : { result: 'fail', missing: missingExpect.map(describeRequirement) }
    const forbidden = (c.forbid ?? []).filter(name => mentions(reply, name))
    checks.forbid = forbidden.length === 0 ? { result: 'pass' } : { result: 'fail', found: forbidden }
    const codeRequired = c.code === 'required'
    checks.code = !codeRequired
      ? { result: 'not-applicable' }
      : evalOutcome.verdict === 'pass' ? { result: 'pass' } : { result: 'fail', detail: evalOutcome }
    const failed = checks.expect.result === 'fail' || checks.forbid.result === 'fail' || checks.code.result === 'fail'
    const verdict = failed ? 'fail' : (codeRequired && evalOutcome.verdict === 'inconclusive') ? 'inconclusive' : 'pass'
    return { checks, formatting, verdict }
  }

  if (c.kind === 'fix') {
    checks.evaluates = evalOutcome.verdict === 'pass'
      ? { result: 'pass' }
      : { result: evalOutcome.verdict === 'inconclusive' ? 'inconclusive' : 'fail', detail: evalOutcome }
    const unchanged = code !== null && collapseWhitespace(code) === collapseWhitespace(c.broken)
    checks.changed = code === null ? { result: 'fail', reason: 'no code in reply' } : unchanged ? { result: 'fail', reason: 'code is unchanged from the broken input' } : { result: 'pass' }
    const missingKeep = (c.keep ?? []).filter(fragment => !code || !containsFragment(code, fragment))
    checks.keep = missingKeep.length === 0 ? { result: 'pass' } : { result: 'fail', missing: missingKeep }
    const failed = checks.evaluates.result === 'fail' || checks.changed.result === 'fail' || checks.keep.result === 'fail'
    const verdict = failed ? 'fail' : checks.evaluates.result === 'inconclusive' ? 'inconclusive' : 'pass'
    return { checks, formatting, verdict }
  }

  // compose
  checks.evaluates = evalOutcome.verdict === 'pass'
    ? { result: 'pass' }
    : { result: evalOutcome.verdict === 'inconclusive' ? 'inconclusive' : 'fail', detail: evalOutcome }
  const missingUse = (c.mustUse ?? []).filter(req => !code || !satisfies(code, req, mentions))
  checks.mustUse = missingUse.length === 0 ? { result: 'pass' } : { result: 'fail', missing: missingUse.map(describeRequirement) }
  const foundForbidden = (c.mustNotUse ?? []).filter(name => code && mentions(code, name))
  checks.mustNotUse = foundForbidden.length === 0 ? { result: 'pass' } : { result: 'fail', found: foundForbidden }
  const minEvents = c.minEvents ?? 1
  const events = evalOutcome.events ?? 0
  checks.minEvents = events >= minEvents ? { result: 'pass' } : { result: 'fail', got: events, wanted: minEvents }
  const failed = ['evaluates', 'mustUse', 'mustNotUse', 'minEvents'].some(k => checks[k].result === 'fail')
  const verdict = failed ? 'fail' : checks.evaluates.result === 'inconclusive' ? 'inconclusive' : 'pass'
  return { checks, formatting, verdict }
}
