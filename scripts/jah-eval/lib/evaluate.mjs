// Evaluation adapter (add-jah-eval-harness task 3.3): turns a reply into the
// `evalOutcome` shape score.mjs expects, by running the reply's primary code
// block through the same headless Strudel evaluator `pattern:check --fast`
// uses (scripts/patterns/lib/triage.mjs). Triage mutates `globalThis.samples`
// per check, so replies must be evaluated one at a time — see run.mjs.

import { primaryBlock } from './replies.mjs'

/**
 * @param {ReturnType<typeof import('../../patterns/lib/triage.mjs').createTriage> extends Promise<infer T> ? T : never} triage
 * @param {string} reply
 * @returns {Promise<{verdict:'pass'|'fail'|'inconclusive'|'no-code', error?:string, missing?:string[], events?:number}>}
 */
export async function evaluateReply(triage, reply) {
  const code = primaryBlock(reply)
  if (code === null) return { verdict: 'no-code' }

  const result = await triage.check(code)
  if (result.status === 'pass') return { verdict: 'pass', events: result.events }
  if (result.status === 'inconclusive') return { verdict: 'inconclusive', events: result.events ?? 0 }
  if (result.status === 'missing-sounds') return { verdict: 'fail', missing: result.missing }
  return { verdict: 'fail', error: result.error } // status === 'error'
}
