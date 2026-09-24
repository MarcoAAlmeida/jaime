// The model call (add-jah-eval-harness task 4.1). `createModelCaller` is the
// only part of this module that touches the network — it wraps the same
// remote Workers AI binding scripts/jah-prompt-eval.mjs uses, with the same
// model server/jah/reply.ts uses for real @jah replies (kept honest by the
// drift-guard test, model-drift.test.mjs), and its ungrounded system prompt
// — `buildSystemPrompt()` with no context blocks, byte-identical to
// `JAH_SYSTEM_PROMPT` — matching the committed baseline (baseline.json).
// Comparing against a *grounded* prompt (add-jah-knowledge-retrieval task
// 6.2) is a deliberate, separate re-run, not this module's job.
// `runSamples` is pure orchestration: it takes `call` as an argument, so it
// is tested with an injected fake and needs neither a model nor a network.

import { generateText } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { renderMessage } from './cases.mjs'
// A .ts import; Node's type stripping handles it (see jah-prompt-eval.mjs).
import { JAH_SYSTEM_PROMPT } from '../../../server/jah/prompt.ts'

/** Must match the model id server/jah/reply.ts calls — see model-drift.test.mjs. */
export const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

/**
 * Wraps the real Workers AI binding (`env.AI`, from `getPlatformProxy`) into
 * a `(message) => Promise<string>` caller — @jah's real system prompt, one
 * user message, no AI Gateway (a measurement should not pollute production
 * logs).
 */
export function createModelCaller(env) {
  const workersai = createWorkersAI({ binding: env.AI })
  return async function call(message) {
    const { text } = await generateText({
      model: workersai(MODEL),
      system: JAH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
    })
    return text
  }
}

/**
 * Runs every case in `cases` through `call`, `samples` times each,
 * `concurrency` calls in flight at once. A call that throws becomes an
 * errored sample (recorded with its reason) rather than aborting the run.
 * Order of the returned array matches `cases`, samples grouped per case.
 *
 * @param {object[]} cases
 * @param {{samples: number, call: (message: string) => Promise<string>, concurrency?: number}} options
 * @returns {Promise<Array<{caseId: string, sampleIndex: number, reply?: string, error?: string}>>}
 */
export async function runSamples(cases, { samples, call, concurrency = 4 }) {
  const jobs = []
  for (const c of cases) for (let i = 0; i < samples; i++) jobs.push({ case: c, sampleIndex: i })
  const results = new Array(jobs.length)

  let next = 0
  async function worker() {
    for (;;) {
      const index = next++
      if (index >= jobs.length) return
      const { case: c, sampleIndex } = jobs[index]
      try {
        const reply = await call(renderMessage(c))
        results[index] = { caseId: c.id, sampleIndex, reply }
      }
      catch (err) {
        results[index] = { caseId: c.id, sampleIndex, error: String(err?.message ?? err) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker))
  return results
}
