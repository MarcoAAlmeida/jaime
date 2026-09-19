import type { ModelMessage } from 'ai'
import { generateText } from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { JAH_SYSTEM_PROMPT } from './prompt'

// The model call seam (add-jah-chat design decision 5) — the only
// place that touches `env.AI`. `JAH_E2E` short-circuits it so local
// dev and e2e never spend real money or need Workers AI access.

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const CANNED_E2E_REPLY = 'This is a canned @jah reply for testing (JAH_E2E).'
// A real model call takes long enough for `jah_typing` and the
// `jahBusy` lock to be observable; an instant stub would make both
// effectively untestable (and the typing indicator would never
// visibly appear in a JAH_E2E-driven e2e run either).
const CANNED_E2E_DELAY_MS = 200

// Workers AI unit pricing for MODEL, per Cloudflare's published rate
// (developers.cloudflare.com/workers-ai/platform/pricing) — an
// estimate for the `ai_usage` audit trail, not a billing-accurate
// figure (Cloudflare's own invoice is the source of truth for spend).
const USD_PER_INPUT_TOKEN = 0.293 / 1_000_000
const USD_PER_OUTPUT_TOKEN = 2.253 / 1_000_000

export interface JahReply {
  text: string
  model: string
  promptTokens: number
  completionTokens: number
  costEstimateUsd: number
}

export async function generateJahReply(env: Env, messages: ModelMessage[]): Promise<JahReply> {
  if (env.JAH_E2E) {
    await new Promise(resolve => setTimeout(resolve, CANNED_E2E_DELAY_MS))
    return { text: CANNED_E2E_REPLY, model: MODEL, promptTokens: 0, completionTokens: 0, costEstimateUsd: 0 }
  }

  const workersai = createWorkersAI({
    binding: env.AI,
    gateway: env.AI_GATEWAY_ID ? { id: env.AI_GATEWAY_ID } : undefined,
  })

  const result = await generateText({
    model: workersai(MODEL),
    system: JAH_SYSTEM_PROMPT,
    messages,
  })

  const promptTokens = result.usage.inputTokens ?? 0
  const completionTokens = result.usage.outputTokens ?? 0
  return {
    text: result.text,
    model: MODEL,
    promptTokens,
    completionTokens,
    costEstimateUsd: promptTokens * USD_PER_INPUT_TOKEN + completionTokens * USD_PER_OUTPUT_TOKEN,
  }
}
