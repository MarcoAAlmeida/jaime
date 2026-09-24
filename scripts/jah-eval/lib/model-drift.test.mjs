// Guards the claim in model.mjs (and design.md decision 2) that the harness
// makes "the same model call" @jah makes for real, without importing
// server/jah/reply.ts (Node can't load its extensionless relative import,
// and it wants an app Env). Reads reply.ts and composition.ts as text
// instead, and fails loudly if either drifts from what MODEL and
// runSamples() assume — a real signal to update this guard deliberately,
// not a false alarm (add-jah-eval-harness task 4.2).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MODEL } from './model.mjs'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const replyTs = readFileSync(`${root}/server/jah/reply.ts`, 'utf8')
const compositionTs = readFileSync(`${root}/server/routes/composition.ts`, 'utf8')

test('reply.ts calls the same model id the harness uses', () => {
  assert.match(replyTs, new RegExp(`MODEL\\s*=\\s*['"]${MODEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`))
})

test('reply.ts builds its system prompt with buildSystemPrompt, the same function the harness can call with no context blocks for the ungrounded baseline (add-jah-knowledge-retrieval)', () => {
  assert.match(replyTs, /system:\s*buildSystemPrompt\(contextBlocks\)/)
})

test('a mention becomes exactly one user message, the way the harness sends its case messages', () => {
  // composition.ts builds the single-message array reply.ts's `messages`
  // parameter receives; the harness's runSamples() likewise sends its
  // rendered case message as the sole user message (model.mjs). The
  // harness itself doesn't run retrieval (task 6.2 is the deliberate,
  // separate re-run against the grounded prompt) — `buildSystemPrompt()`
  // with no arguments is byte-identical to today's baseline call.
  assert.match(compositionTs, /role:\s*'user',\s*content:\s*mention\.rest/)
  assert.match(compositionTs, /generateJahReply\(env,\s*\[userMessage\],\s*retrieval\.contextBlocks\)/)
})
