import type { TrackName } from '#shared/tracks'
import { evalScope } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { transpiler } from '@strudel/transpiler'
import { initAudioOnFirstClick, registerSynthSounds, webaudioRepl } from '@strudel/webaudio'
import { waitForSynchronizedStart } from '~/lib/transportClock'

interface StrudelRepl {
  evaluate: (code: string, autostart?: boolean) => Promise<unknown>
  stop: () => void
}

let ready: Promise<void> | undefined
const repls = new Map<TrackName, StrudelRepl>()
const lastErrors = new Map<TrackName, string | null>()

async function bootstrap() {
  // @strudel/mini must be evalScope'd too: the transpiler statically
  // rewrites string literals into `m("...", offset)` calls, so `m` (from
  // @strudel/mini) needs to be a real global, not just the string parser
  // miniAllStrings() sets up for runtime Pattern.reify() coercion.
  await evalScope(import('@strudel/core'), import('@strudel/mini'))
  miniAllStrings()
  // Registers built-in oscillator waveforms (sawtooth, sine, square,
  // triangle) as usable .s(...) sounds. Sample-bank sounds (drum hits
  // etc.) need a separate samples() call with a source URL — not needed
  // for the manual synth-only tests so far, deliberately avoiding a
  // network dependency this early.
  registerSynthSounds()
}

function ensureReady() {
  ready ??= bootstrap()
  return ready
}

/**
 * Registers the "resume audio on next click" listener as early as
 * possible (call from onMounted), so it's satisfied by the click a user
 * makes to focus the editor rather than being registered too late —
 * inside evaluate() itself — and waiting on a click that never comes
 * again once interaction goes keyboard-only (Ctrl-Enter).
 *
 * Returns the promise that resolves once that click has happened
 * (browsers create the AudioContext suspended until a genuine user
 * gesture resumes it — there's no way around this). evaluate() itself
 * already awaits this internally, so a track that's already playing
 * when a client joins silently sits blocked on this exact promise until
 * the user clicks anything on the page — jam.vue awaits the return
 * value here only to show a "tap to enable audio" prompt while that's
 * pending, not because evaluate() needs it awaited twice.
 */
export function primeAudio(): Promise<void> {
  return initAudioOnFirstClick()
}

// One webaudioRepl per track, sharing the singleton AudioContext
// (getAudioContext() returns the same instance regardless of how many
// repls call it — no explicit sharing logic needed). beforeStart is
// passed once, here, at construction: it's a stable function reference
// that reads live transport-clock state each time Strudel actually
// calls it, not a snapshot from construction time.
function getRepl(track: TrackName): StrudelRepl {
  let repl = repls.get(track)
  if (!repl) {
    repl = webaudioRepl({
      transpiler,
      beforeStart: waitForSynchronizedStart,
      onEvalError: (error: Error) => {
        lastErrors.set(track, error.message)
      },
    }) as StrudelRepl
    repls.set(track, repl)
  }
  return repl
}

/**
 * Evaluates a track's Strudel pattern code and starts its playback.
 * Errors in the pattern are caught internally by the Strudel repl (the
 * scheduler stays usable for the next evaluation) and returned here
 * instead of thrown.
 */
export async function evaluate(track: TrackName, code: string): Promise<string | null> {
  await ensureReady()
  await initAudioOnFirstClick()
  lastErrors.set(track, null)
  await getRepl(track).evaluate(code)
  return lastErrors.get(track) ?? null
}

export async function stop(track: TrackName) {
  await ensureReady()
  repls.get(track)?.stop()
}
