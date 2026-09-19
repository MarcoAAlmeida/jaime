// Engine setup shared by every editor instance (add-strudel-parity).
// Mirrors strudel.cc's own prebake (packages/repl/prebake.mjs): eval
// scopes, the synth voices, the GM soundfont voices, the default sample
// map, and the drum-machine bank aliases. Memoised — the returned
// promise is created once and handed to every StrudelMirror.
//
// Load ordering deliberately matches jaime's existing contract
// (shared/tracks.ts): synth-only playback must not wait on the network.
// So prebake() resolves once the eval scopes + synth voices + the
// dirt-samples bank are ready; the broader strudel.cc banks (drum
// machines, piano, VCSL, GM soundfonts, …) load in the background and a
// pattern that names one makes sound as soon as its bank arrives.

import { evalScope, Pattern } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { aliasBank, registerSynthSounds, registerZZFXSounds, samples } from '@strudel/webaudio'

// felixroos/dough-samples — the manifests strudel.cc's REPL bakes.
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main'
// todepond/samples — maps drum-machine short names (tr909, linn, …) onto
// the full bank names in tidal-drum-machines.json.
const DRUM_MACHINE_ALIASES = 'https://raw.githubusercontent.com/todepond/samples/main/tidal-drum-machines-alias.json'

const EXTRA_BANKS = [
  `${DOUGH}/piano.json`,
  `${DOUGH}/EmuSP12.json`,
  `${DOUGH}/vcsl.json`,
  `${DOUGH}/mridangam.json`,
]

let prebaked: Promise<void> | undefined

async function loadBank(url: string): Promise<void> {
  try {
    await samples(url)
  }
  catch (error) {
    console.warn(`[prebake] sample bank failed to load: ${url}`, error)
  }
}

// The underscore-prefixed widget methods (_pianoroll, _punchcard,
// _spiral, _scope, _pitchwheel, _spectrum) are normally registered by
// @strudel/codemirror as a side effect of StrudelMirror mounting — real
// hosts for its own visual gutter (Composition Room, JAM). The Pattern
// Library's standalone preview (audioEngine.ts) never mounts a
// CodeMirror instance, so those methods were simply missing there: any
// curated pattern chaining one (e.g. Birds of a Feather's
// ._pitchwheel(...)) threw "is not a function" on Preview despite
// evaluating fine as a Composition Room starter (add-favorite-patterns
// migrated it into the shared catalog, which is what first exercised
// this path). Registered here — shared by every prebake() consumer —
// against a detached canvas: the draw happens, just nowhere visible,
// which is fine, since nothing outside the real editor surfaces
// per-widget UI anyway. Mirrors @strudel/codemirror/widget.mjs's own
// option-shaping exactly, minus its CodeMirror decoration wiring.
function headlessCanvas(width: number, height: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d')
}

// Composition Room and JAM import @strudel/codemirror (for
// StrudelMirror) before this ever runs, which registers the *real*
// versions — wired to the visible editor gutter — as a module-load
// side effect. Only fill in a stub where nothing is registered yet
// (the Pattern Library preview); never clobber the real one.
function defineIfMissing(proto: Record<string, unknown>, name: string, fn: unknown): void {
  if (typeof proto[name] !== 'function') proto[name] = fn
}

function registerHeadlessWidgets(): void {
  const proto = Pattern.prototype as Record<string, unknown>

  defineIfMissing(proto, '_pianoroll', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const shaped = { fold: 1, width: 500, height: 60, ...options }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.tag(id).pianoroll({ ...shaped, ctx, id })
  })
  defineIfMissing(proto, '_punchcard', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const shaped = { fold: 1, width: 500, height: 60, ...options }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.tag(id).punchcard({ ...shaped, ctx, id })
  })
  defineIfMissing(proto, '_spiral', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const size = Number(options.size) || 275
    const shaped = { width: size, height: size, ...options, size: size / 5 }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.spiral({ ...shaped, ctx, id })
  })
  defineIfMissing(proto, '_scope', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const shaped = { width: 500, height: 60, pos: 0.5, scale: 1, ...options }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.scope({ ...shaped, ctx, id })
  })
  defineIfMissing(proto, '_pitchwheel', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const size = Number(options.size) || 200
    const shaped = { width: size, height: size, ...options, size: size / 5 }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.pitchwheel({ ...shaped, ctx, id })
  })
  defineIfMissing(proto, '_spectrum', function (this: typeof Pattern.prototype, id: string, options: Record<string, unknown> = {}) {
    const size = Number(options.size) || 200
    const shaped = { width: size, height: size, ...options, size: size / 5 }
    const ctx = headlessCanvas(Number(shaped.width), Number(shaped.height))
    return this.spectrum({ ...shaped, ctx, id })
  })
}

async function run(): Promise<void> {
  await evalScope(
    import('@strudel/core'),
    import('@strudel/mini'),
    import('@strudel/tonal'),
    import('@strudel/draw'),
    import('@strudel/webaudio'),
  )
  miniAllStrings()
  registerSynthSounds()
  registerZZFXSounds()
  registerHeadlessWidgets()

  // General MIDI soundfont voices — `gm_*` names (gm_lead_2_sawtooth,
  // gm_epiano1, …). @strudel/soundfonts must be a *dynamic* import: a
  // static one pulls soundfont2, which touches `window` at module load
  // and breaks SSR (strudel.cc hits the same and does the same).
  // Registration is synchronous and free; each font's samples are
  // fetched on first use.
  void import('@strudel/soundfonts')
    .then(({ registerSoundfonts }) => registerSoundfonts())
    .catch((error: unknown) => console.warn('[prebake] soundfonts failed to register', error))

  // The bank every curated pattern needs — awaited so those patterns are
  // never silent once prebake resolves.
  await loadBank('github:tidalcycles/dirt-samples')

  // Everything else strudel.cc offers — best-effort, not awaited. The
  // drum-machine aliases must land *after* tidal-drum-machines.json, so
  // they share one chain.
  void loadBank(`${DOUGH}/tidal-drum-machines.json`).then(() =>
    aliasBank(DRUM_MACHINE_ALIASES).catch((error: unknown) =>
      console.warn('[prebake] drum-machine aliases failed to load', error),
    ),
  )
  void Promise.all(EXTRA_BANKS.map(loadBank))
}

export function prebake(): Promise<void> {
  prebaked ??= run()
  return prebaked
}
