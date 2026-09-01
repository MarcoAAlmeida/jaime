// Engine setup shared by every editor instance (add-strudel-parity).
// Mirrors strudel.cc's own prebake: eval scopes, the synth voices, and
// the default sample map. Memoised — the returned promise is created
// once and handed to every StrudelMirror.
//
// Load ordering deliberately matches jaime's existing contract
// (shared/tracks.ts): synth-only playback must not wait on the network.
// So prebake() resolves once the eval scopes + synth voices + the
// dirt-samples bank every curated pattern relies on are ready; the
// broader strudel.cc banks (drum machines, piano, VCSL, …) load in the
// background and a pattern that names one of those makes sound as soon
// as its bank arrives.

import { evalScope } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { registerSynthSounds, registerZZFXSounds, samples } from '@strudel/webaudio'

// felixroos/dough-samples — the manifests strudel.cc's REPL bakes.
const DOUGH = 'https://raw.githubusercontent.com/felixroos/dough-samples/main'

const EXTRA_BANKS = [
  `${DOUGH}/tidal-drum-machines.json`,
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

  // The bank every curated pattern needs — awaited so those patterns are
  // never silent once prebake resolves.
  await loadBank('github:tidalcycles/dirt-samples')

  // Everything else strudel.cc offers — best-effort, not awaited.
  void Promise.all(EXTRA_BANKS.map(loadBank))
}

export function prebake(): Promise<void> {
  prebaked ??= run()
  return prebaked
}
