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
}
