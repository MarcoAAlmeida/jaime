declare module '@strudel/codemirror' {
  import type { EditorView, ViewUpdate } from '@codemirror/view'

  interface InitEditorOptions {
    root: HTMLElement | undefined
    initialCode?: string
    onChange?: (update: ViewUpdate) => void
    onEvaluate?: () => void
    onStop?: () => void
    mondo?: boolean
  }

  export function initEditor(options: InitEditorOptions): EditorView

  interface StrudelMirrorOptions {
    root: HTMLElement
    initialCode?: string
    prebake: () => Promise<unknown>
    solo?: boolean
    // eslint-disable-next-line ts/no-explicit-any
    drawContext?: any
    // eslint-disable-next-line ts/no-explicit-any
    [key: string]: any
  }

  export class StrudelMirror {
    constructor(options: StrudelMirrorOptions)
    editor: EditorView
    code: string
    evaluate: (autostart?: boolean) => Promise<void>
    stop: () => Promise<void>
    setCode: (code: string) => void
    clear: () => void
    draw: (haps: unknown, time: unknown, painters?: unknown[]) => void
    onDraw: (haps: unknown, time: unknown, painters?: unknown[]) => void
    drawer?: {
      setDrawTime: (dt: [number, number]) => void
      invalidate: (scheduler?: unknown, t?: number) => void
    }
  }
}
