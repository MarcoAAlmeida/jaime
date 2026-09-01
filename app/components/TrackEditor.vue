<script setup lang="ts">
import type { StrudelEditor } from '~/lib/strudelEditor'
import { createStrudelEditor } from '~/lib/strudelEditor'

const props = defineProps<{
  code: string
  editable: boolean
}>()

const emit = defineEmits<{
  'update:code': [code: string]
  'update:error': [error: string | null]
  'requestPlay': []
  'requestStop': []
}>()

const editorEl = ref<HTMLDivElement>()
const canvasEl = ref<HTMLCanvasElement>()
const hasVisuals = ref(false)
const colorMode = useColorMode()

let editor: StrudelEditor | undefined
let ready: Promise<StrudelEditor> | undefined
// While applying code that came from outside this editor (a WebSocket
// relay), the factory's own guard suppresses the echo — this flag is a
// second guard for the props.code watcher itself.
let applyingExternal = false

onMounted(() => {
  ready = createStrudelEditor({
    root: editorEl.value!,
    drawContext: canvasEl.value?.getContext('2d') ?? null,
    initialCode: props.code,
    editable: props.editable,
    onCodeChange: (code) => {
      if (!applyingExternal) emit('update:code', code)
    },
    onError: error => emit('update:error', error),
    onRequestPlay: () => emit('requestPlay'),
    onRequestStop: () => emit('requestStop'),
    onVisualsChange: has => (hasVisuals.value = has),
  }).then((e) => {
    editor = e
    // props.code can change during the async import gap (e.g. a
    // "Load into JAM" seed lands before the editor is ready) — the
    // watcher below bails while `editor` is undefined, so re-sync here.
    if (props.code !== e.view.state.doc.toString()) {
      applyingExternal = true
      try {
        e.setCode(props.code)
      }
      finally {
        applyingExternal = false
      }
    }
    // @strudel/codemirror's initTheme() forces the dark class on <html>
    // to match its editor theme — re-assert the app's real colour mode
    // on the root so the surrounding shell isn't dragged dark.
    document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
    document.documentElement.classList.toggle('light', colorMode.value === 'light')
    return e
  })
})

onBeforeUnmount(() => {
  editor?.destroy()
})

watch(() => props.code, (newCode) => {
  if (!editor || newCode === editor.view.state.doc.toString()) return
  applyingExternal = true
  try {
    editor.setCode(newCode)
  }
  finally {
    applyingExternal = false
  }
})

watch(() => props.editable, (editable) => {
  editor?.setEditable(editable)
})

defineExpose({
  async evaluate() {
    await (await ready)?.evaluate()
  },
  async stop() {
    (await ready)?.stop()
  },
})
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div ref="editorEl" class="min-h-0 flex-1 overflow-hidden rounded-md" />
    <canvas
      ref="canvasEl"
      width="600"
      height="140"
      class="mt-2 w-full rounded-md"
      :class="hasVisuals ? '' : 'hidden'"
      data-testid="track-canvas"
    />
  </div>
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
}

:deep(.cm-scroller) {
  overflow: auto;
}
</style>
