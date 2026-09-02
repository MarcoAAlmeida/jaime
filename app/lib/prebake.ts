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

import { evalScope } from '@strudel/core'
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
