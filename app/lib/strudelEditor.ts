// One editor + repl at strudel.cc parity (add-strudel-parity). Wraps
// @strudel/codemirror's StrudelMirror — which bundles the CodeMirror
// editor, the webaudio repl, mini-notation highlighting, the @strudel/
// draw painters, and slider/widget support — behind the small surface
// jaime needs.
//
// One instance per JAM track (solo:false, so tracks coexist); the
// Composition Room reuses the same factory and appends yCollab.

import type { EditorView } from '@codemirror/view'
import { Compartment, StateEffect } from '@codemirror/state'
import { EditorView as EV } from '@codemirror/view'
import { getAudioContext, initAudioOnFirstClick, webaudioOutput } from '@strudel/webaudio'
import { prebake } from '~/lib/prebake'
import { waitForSynchronizedStart } from '~/lib/transportClock'

export interface StrudelEditorOptions {
  root: HTMLElement
  /**
   * 2D context handed to @strudel/draw so a visual call in a pattern
   * (`.pianoroll()` etc.) draws there rather than making @strudel/draw
   * spawn its own full-viewport canvas. Pattern-driven visuals are not
   * finished — see add-strudel-parity; for now this just contains the
   * side effect.
   */
  drawContext?: CanvasRenderingContext2D | null
  initialCode: string
  editable: boolean
  /** Fired for LOCAL edits only — never for setCode() from outside. */
  onCodeChange?: (code: string) => void
  onError?: (message: string | null) => void
  /**
   * Ctrl-Enter in the editor. In JAM this broadcasts a play request
   * rather than evaluating locally — the caller then drives the actual
   * playback for every client via evaluate(). Omit to fall back to
   * evaluating locally.
   */
  onRequestPlay?: () => void
  /** Ctrl-. in the editor. Same idea as onRequestPlay. */
  onRequestStop?: () => void
}

export interface StrudelEditor {
  readonly view: EditorView
  readonly error: string | null
  evaluate: () => Promise<void>
  stop: () => void
  /** Apply code from outside (a WS relay); does not fire onCodeChange. */
  setCode: (code: string) => void
  setEditable: (editable: boolean) => void
  destroy: () => void
}

/** Resume the shared AudioContext on the first user gesture. */
export async function primeAudio(): Promise<void> {
  await initAudioOnFirstClick()
}

export async function createStrudelEditor(opts: StrudelEditorOptions): Promise<StrudelEditor> {
  const [{ StrudelMirror }, { transpiler }] = await Promise.all([
    import('@strudel/codemirror'),
    import('@strudel/transpiler'),
  ])

  let error: string | null = null
  let applyingExternal = false

  const mirror = new StrudelMirror({
    root: opts.root,
    initialCode: opts.initialCode,
    prebake,
    solo: false,
    transpiler,
    drawContext: opts.drawContext ?? undefined,
    defaultOutput: webaudioOutput,
    getTime: () => getAudioContext().currentTime,
    // Every scheduler start aligns to the room's shared cycle boundary
    // — same hook JAM's bespoke repl used.
    beforeStart: waitForSynchronizedStart,
    onEvalError: (err: Error) => {
      error = err.message
      opts.onError?.(err.message)
    },
  })

  // StrudelMirror's baked keymap calls mirror.evaluate() / mirror.stop()
  // on Ctrl-Enter / Ctrl-. In JAM those must broadcast, not fire local
  // audio — so route the keyboard path through the caller's callbacks
  // and keep the native methods for programmatic (per-client) playback.
  const nativeEvaluate = mirror.evaluate.bind(mirror)
  const nativeStop = mirror.stop.bind(mirror)
  if (opts.onRequestPlay) mirror.evaluate = async () => { opts.onRequestPlay!() }
  if (opts.onRequestStop) mirror.stop = async () => { opts.onRequestStop!() }

  const editable = new Compartment()
  mirror.editor.dispatch({
    effects: StateEffect.appendConfig.of([
      editable.of(EV.editable.of(opts.editable)),
      // Emit local edits upward. StrudelMirror's own onChange (which
      // keeps mirror.code / the repl in sync) still runs; this is
      // additive.
      EV.updateListener.of((u) => {
        if (u.docChanged && !applyingExternal) {
          opts.onCodeChange?.(u.state.doc.toString())
        }
      }),
    ]),
  })

  return {
    get view() {
      return mirror.editor
    },
    get error() {
      return error
    },
    async evaluate() {
      error = null
      opts.onError?.(null)
      await nativeEvaluate()
    },
    stop() {
      nativeStop()
    },
    setCode(code: string) {
      if (code === mirror.editor.state.doc.toString()) return
      applyingExternal = true
      try {
        mirror.setCode(code)
      }
      finally {
        applyingExternal = false
      }
    },
    setEditable(next: boolean) {
      mirror.editor.dispatch({ effects: editable.reconfigure(EV.editable.of(next)) })
    },
    destroy() {
      try {
        nativeStop()
      }
      catch { /* scheduler already stopped */ }
      mirror.clear() // removes StrudelMirror's document event listeners
      mirror.editor.destroy()
    },
  }
}
