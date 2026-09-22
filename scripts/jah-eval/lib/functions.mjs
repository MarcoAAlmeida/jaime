// The function-existence check's seam (add-jah-eval-harness task 3.1). No
// Strudel documentation index exists yet — that is roadmap Phase 1
// (add-strudel-knowledge-corpus). Until it does, this reports the check as
// unavailable rather than silently skipping it; score.mjs reads this and
// records the check as neither a pass nor a fail. Phase 1 makes this return
// the real index and score.mjs's function-existence check starts reporting
// real results, with no change to any case.

/**
 * @returns {Promise<{ available: false, reason: string } | { available: true, has: (name: string) => boolean }>}
 */
export async function loadFunctionIndex() {
  return { available: false, reason: 'no Strudel documentation index yet (roadmap Phase 1, add-strudel-knowledge-corpus)' }
}
