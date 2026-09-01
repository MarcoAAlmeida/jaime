// Pattern-library preview playback. JAM tracks moved to
// app/lib/strudelEditor.ts (per-track StrudelMirror); this file is now
// just the standalone "audition a library pattern" repl. Sound sources
// come from the same prebake() the JAM editors use.

import { transpiler } from '@strudel/transpiler'
import { initAudioOnFirstClick, webaudioRepl } from '@strudel/webaudio'
import { prebake } from '~/lib/prebake'

interface StrudelRepl {
  evaluate: (code: string, autostart?: boolean) => Promise<unknown>
  stop: () => void
}

/**
 * Registers the "resume audio on next click" listener as early as
 * possible (call from onMounted), so it's satisfied by the click a user
 * makes to focus the editor rather than being registered too late.
 */
export function primeAudio(): Promise<void> {
  return initAudioOnFirstClick()
}

let previewRepl: StrudelRepl | undefined
let previewError: string | null = null

function getPreviewRepl(): StrudelRepl {
  previewRepl ??= webaudioRepl({
    transpiler,
    onEvalError: (error: Error) => {
      previewError = error.message
    },
  }) as StrudelRepl
  return previewRepl
}

/**
 * Evaluates a pattern's code on the shared preview repl and starts it.
 * Returns the evaluation error message, or null on success.
 */
export async function evaluatePreview(code: string): Promise<string | null> {
  await prebake()
  await initAudioOnFirstClick()
  previewError = null
  await getPreviewRepl().evaluate(code)
  return previewError
}

export async function stopPreview() {
  previewRepl?.stop()
}
