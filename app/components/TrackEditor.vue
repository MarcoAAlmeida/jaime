<script setup lang="ts">
import type { EditorView } from '@codemirror/view'
import { initEditor } from '@strudel/codemirror'

const props = defineProps<{
  code: string
}>()

const emit = defineEmits<{
  'update:code': [code: string]
  evaluate: []
  stop: []
}>()

const editorEl = ref<HTMLDivElement>()
let editorView: EditorView | undefined
let isApplyingExternalUpdate = false

onMounted(() => {
  editorView = initEditor({
    root: editorEl.value,
    initialCode: props.code,
    onChange: (update) => {
      if (update.docChanged && !isApplyingExternalUpdate) {
        emit('update:code', update.state.doc.toString())
      }
    },
    onEvaluate: () => emit('evaluate'),
    onStop: () => emit('stop'),
  })
})

onBeforeUnmount(() => {
  editorView?.destroy()
})

// Applies code changes that came from outside this editor (e.g. a
// WebSocket relay update) without re-triggering onChange above — which
// would otherwise emit('update:code') right back out and echo the
// update, or fight the user's own cursor if they're mid-edit.
watch(() => props.code, (newCode) => {
  if (!editorView) {
    return
  }
  const currentDoc = editorView.state.doc.toString()
  if (newCode === currentDoc) {
    return
  }
  isApplyingExternalUpdate = true
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: newCode },
  })
  isApplyingExternalUpdate = false
})
</script>

<template>
  <div ref="editorEl" class="h-full w-full" />
</template>

<style scoped>
/*
 * CodeMirror's .cm-editor has an intrinsic (content-sized) height by
 * default. These aren't Tailwind utility classes applied to CodeMirror's
 * internal nodes (see docs/03-architecture-frontend.md) — just plain CSS
 * making the editor fill this component's wrapper div.
 */
:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}
</style>
