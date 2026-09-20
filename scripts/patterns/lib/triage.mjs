// Node-only triage of a Strudel pattern: evaluate it with the real Strudel
// packages (no browser, no audio), query a few cycles, and compare the
// sound names it asks for with what the app really loads. Milliseconds per
// pattern, so it can sift a big batch — but it is a TRIAGE, not the gate:
// patterns that produce no events here are "inconclusive", and a Node-only
// error may be a helper the browser REPL provides. The real-engine check
// (e2e/pattern-playback.spec.ts, via check.mjs) stays the gate.
// See openspec/changes/add-pattern-ingestion-skill/design.md, decision 7.

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

const RAW = 'https://raw.githubusercontent.com'
export const DOUGH = `${RAW}/felixroos/dough-samples/main`
/** Mirrors app/lib/prebake.ts — test/drift guard in triage.test.mjs. */
export const BANK_URLS = [
  `${RAW}/tidalcycles/dirt-samples/main/strudel.json`, // github:tidalcycles/dirt-samples
  `${DOUGH}/tidal-drum-machines.json`,
  `${DOUGH}/piano.json`,
  `${DOUGH}/EmuSP12.json`,
  `${DOUGH}/vcsl.json`,
  `${DOUGH}/mridangam.json`,
]
export const DRUM_MACHINE_ALIASES = `${RAW}/todepond/samples/main/tidal-drum-machines-alias.json`

const SYNTHS = ['sawtooth', 'square', 'triangle', 'sine', 'supersaw', 'pulse', 'white', 'pink', 'brown', 'crackle', 'zzfx', 'z_sine', 'z_sawtooth', 'z_triangle', 'z_square', 'z_tan', 'z_noise']

// Visual widgets need a canvas; headless they are identity no-ops (the app's
// prebake does the same in registerHeadlessWidgets).
const WIDGETS = ['pianoroll', '_pianoroll', 'punchcard', '_punchcard', 'scope', '_scope', 'tscope', 'fscope', 'spectrum', '_spectrum', 'spiral', '_spiral', 'pitchwheel', '_pitchwheel', 'wordfall', '_wordfall', 'markcss', 'draw', 'onPaint', '_draw', '_hydra', 'hydra', 'osc', '_osc']
const NOOP_GLOBALS = ['setcps', 'setcpm', 'setCps', 'setCpm', 'hush']

const mapKeys = json => Object.keys(json).filter(k => k !== '_base')
const lc = s => String(s).toLowerCase()

async function fetchJson(fetchFn, url) {
  const res = await fetchFn(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return JSON.parse(await res.text())
}

/** `github:user/repo[/branch]` → its strudel.json URL; a plain URL passes through. */
function samplesUrl(arg) {
  const m = /^github:([^/]+)\/([^/]+)(?:\/(.+))?$/.exec(arg)
  return m ? `${RAW}/${m[1]}/${m[2]}/${m[3] || 'main'}/strudel.json` : arg
}

/** The set of sound names (lowercase) the app has after prebake(). */
export async function loadKnownSounds(fetchFn = globalThis.fetch) {
  const known = new Set()
  for (const k of Object.keys((await import('@strudel/soundfonts/gm.mjs')).default)) known.add(lc(k))
  for (const s of SYNTHS) known.add(s)
  const maps = await Promise.all(BANK_URLS.map(u => fetchJson(fetchFn, u)))
  for (const m of maps) for (const k of mapKeys(m)) known.add(lc(k))
  // The alias file maps a full bank name to its short name(s): `AkaiLinn` → `Linn`.
  const aliases = await fetchJson(fetchFn, DRUM_MACHINE_ALIASES)
  for (const [bank, alias] of Object.entries(aliases)) {
    const prefix = `${lc(bank)}_`
    for (const a of [].concat(alias)) {
      for (const k of [...known]) if (k.startsWith(prefix)) known.add(`${lc(a)}_${k.slice(prefix.length)}`)
    }
  }
  return known
}

let engine
/** One-time engine setup (process-wide: Strudel registers globals). */
async function initEngine() {
  engine ??= (async () => {
    // @kabelsalat/web has a broken "main" (the Nuxt config aliases it too);
    // point Node at its working ESM build before Strudel core imports it.
    const { register } = await import('node:module')
    const target = pathToFileURL(require.resolve('@kabelsalat/web/package.json').replace(/package\.json$/, 'dist/index.mjs')).href
    register(`data:text/javascript,${encodeURIComponent(`export async function resolve(s, c, n) { return s === '@kabelsalat/web' ? { url: ${JSON.stringify(target)}, shortCircuit: true } : n(s, c) }`)}`, import.meta.url)
    const core = await import('@strudel/core')
    const { miniAllStrings } = await import('@strudel/mini')
    const { transpiler } = await import('@strudel/transpiler')
    await core.evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/tonal'))
    miniAllStrings()
    for (const w of WIDGETS) if (!core.Pattern.prototype[w]) core.Pattern.prototype[w] = function () { return this }
    core.Pattern.prototype.p = function () { return this } // labelled patterns register in the REPL; no-op here
    for (const n of NOOP_GLOBALS) globalThis[n] = () => {}
    return { evaluate: core.evaluate, transpiler }
  })()
  return engine
}

/**
 * @param {{ fetch?: typeof fetch, cycles?: number, known?: Set<string> }} [options]
 * @returns {Promise<{ check: (code: string) => Promise<{ status: 'pass'|'error'|'missing-sounds'|'inconclusive', error?: string, missing?: string[], events?: number, notes?: string[] }> }>}
 */
export async function createTriage(options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch
  const cycles = options.cycles ?? 8
  const base = options.known ?? await loadKnownSounds(fetchFn)
  const { evaluate, transpiler } = await initEngine()

  return {
    async check(code) {
      // `samples()` in one pattern registers names for that pattern only.
      const known = new Set(base)
      const pending = []
      const notes = []
      globalThis.samples = (arg) => {
        const p = (async () => {
          try {
            if (typeof arg === 'string') for (const k of mapKeys(await fetchJson(fetchFn, samplesUrl(arg)))) known.add(lc(k))
            else if (arg && typeof arg === 'object') for (const k of Object.keys(arg)) if (k !== '_base') known.add(lc(k))
          }
          catch (err) {
            notes.push(`samples(${typeof arg === 'string' ? `'${arg}'` : '…'}) failed: ${err.message}`)
          }
        })()
        pending.push(p)
        return p
      }
      try {
        const { pattern } = await evaluate(code, transpiler)
        await Promise.all(pending)
        const haps = pattern.queryArc(0, cycles)
        const missing = new Set()
        for (const h of haps) {
          const v = h.value
          if (!v || typeof v.s !== 'string') continue
          const name = lc(v.bank ? `${v.bank}_${v.s}` : v.s)
          if (!known.has(name)) missing.add(v.bank ? `${v.bank}_${v.s}` : v.s)
        }
        if (missing.size) return { status: 'missing-sounds', missing: [...missing], events: haps.length, notes }
        if (haps.length === 0) return { status: 'inconclusive', events: 0, notes: [...notes, `no events in ${cycles} cycles here — it may still play in the browser`] }
        return { status: 'pass', events: haps.length, notes }
      }
      catch (err) {
        return { status: 'error', error: String(err?.message ?? err).slice(0, 200), notes }
      }
    },
  }
}
