import { evalScope } from '@strudel/core'
import { miniAllStrings } from '@strudel/mini'
import { transpiler } from '@strudel/transpiler'
import { initAudioOnFirstClick, registerSynthSounds, webaudioRepl } from '@strudel/webaudio'

interface StrudelRepl {
  evaluate: (code: string, autostart?: boolean) => Promise<unknown>
  stop: () => void
}

let ready: Promise<void> | undefined
let repl: StrudelRepl | undefined
let lastError: string | null = null

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
  // for Phase 1's synth-only manual test, deliberately avoiding a
  // network dependency this early.
  registerSynthSounds()
  repl = webaudioRepl({
    transpiler,
    onEvalError: (error: Error) => {
      lastError = error.message
    },
  }) as StrudelRepl
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
 */
export function primeAudio() {
  initAudioOnFirstClick()
}

/**
 * Evaluates Strudel pattern code and starts playback. Errors in the
 * pattern are caught internally by the Strudel repl (the scheduler stays
 * usable for the next evaluation) and returned here instead of thrown.
 */
export async function evaluate(code: string): Promise<string | null> {
  await ensureReady()
  await initAudioOnFirstClick()
  lastError = null
  await repl!.evaluate(code)
  return lastError
}

export async function stop() {
  await ensureReady()
  repl!.stop()
}
