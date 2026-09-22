#!/usr/bin/env node
// Measures `@jah`'s system prompt against the REAL model (add-jah-code-cards
// design decision 1). Not part of `npm test` — it spends real (tiny) money:
// about $0.06 for the defaults (14 questions x 2 samples x 3 variants).
//
//   npx wrangler login          # once; Workers AI is a remote binding
//   node scripts/jah-prompt-eval.mjs [--samples 2] [--variants current,line,final]
//
// It imports the prompt straight from server/jah/prompt.ts (Node's type
// stripping handles the file), builds prompt variants around it, sends each
// question through the same `generateText` call server/jah/reply.ts makes,
// and prints one row per variant:
//
//   fenced        the reply has a ``` fence at all
//   strudel       a fence labelled strudel (label on the fence line) whose
//                 code has balanced brackets/quotes — i.e. runs as-is
//   recoverable   the chat's tolerant reader would still make a card: any
//                 strudel/js/javascript/unlabelled fence, or the label on the
//                 line after the fence
//   silent        code that uses a sound this app does not load by default
//                 (the amen break) without a `samples(...)` line to load it
//   invented      a `samples('github:...')` pointing at a repo other than the
//                 two known-real ones
//
// The gateway is bypassed on purpose (a measurement should not pollute the
// production gateway's logs); the model is the one in reply.ts.

import { fileURLToPath } from 'node:url'
import { generateText } from 'ai'
import { getPlatformProxy } from 'wrangler'
import { createWorkersAI } from 'workers-ai-provider'
import { score } from './jah-eval/lib/replies.mjs'
import { JAH_BASE_PROMPT, JAH_EXAMPLES } from '../server/jah/prompt.ts'

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

const QUESTIONS = [
  'what does .fast do?',
  'how do I make a kick and snare pattern?',
  'how do I add reverb to a pattern?',
  'give me a simple four on the floor beat',
  'how do euclidean rhythms work?',
  'how can I make a bassline?',
  'how do I use the amen break?',
  'how do I make a jungle breakbeat?',
  'what is a polyrhythm and how do I write one?',
  'how do I filter a sound with lpf?',
  'how do I make a chord progression?',
  'how do I make a pattern that changes every other cycle?',
  'how do I pan a sound left and right?',
  'how do I slow a pattern down?',
]

// The one-line variant is the design's "+ the one line" row: the
// instruction without the pack pointer.
const LINE_ONLY = JAH_EXAMPLES.split('\n')
  .join(' ')
  .replace(/ Breakbeats such as.*$/s, '')

const VARIANTS = {
  current: JAH_BASE_PROMPT,
  line: `${JAH_BASE_PROMPT}\n\n${LINE_ONLY}`,
  final: `${JAH_BASE_PROMPT}\n\n${JAH_EXAMPLES}`,
}

// fences/balanced/REAL_PACKS/UNLOADED_SOUNDS/score moved to
// jah-eval/lib/replies.mjs (add-jah-eval-harness task 1.1/1.2) so the eval
// harness scores replies the same way this script always has.

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const samples = Number(arg('samples', 2))
const wanted = arg('variants', 'current,line,final').split(',')

// Only the AI binding (see the config's header) — not the app's wrangler.jsonc.
const { env, dispose } = await getPlatformProxy({
  configPath: fileURLToPath(new URL('./jah-prompt-eval.wrangler.jsonc', import.meta.url)),
})
const workersai = createWorkersAI({ binding: env.AI })

const rows = []
for (const name of wanted) {
  const system = VARIANTS[name]
  if (!system) throw new Error(`unknown variant "${name}" (have: ${Object.keys(VARIANTS).join(', ')})`)
  const tally = { n: 0, fenced: 0, strudel: 0, recoverable: 0, silent: 0, invented: 0 }
  for (const question of QUESTIONS) {
    for (let i = 0; i < samples; i++) {
      const { text } = await generateText({
        model: workersai(MODEL),
        system,
        messages: [{ role: 'user', content: question }],
      })
      const s = score(text)
      tally.n++
      for (const k of ['fenced', 'strudel', 'recoverable', 'silent', 'invented']) if (s[k]) tally[k]++
    }
  }
  rows.push({ variant: name, ...tally })
}
await dispose()

const pct = (a, n) => `${Math.round((a / n) * 100)}%`
console.log('\nvariant   n    fenced  strudel  recoverable  silent  invented')
for (const r of rows) {
  console.log(
    `${r.variant.padEnd(9)} ${String(r.n).padEnd(4)} ${pct(r.fenced, r.n).padEnd(7)} ${pct(r.strudel, r.n).padEnd(8)} ${pct(r.recoverable, r.n).padEnd(12)} ${pct(r.silent, r.n).padEnd(7)} ${pct(r.invented, r.n)}`,
  )
}
