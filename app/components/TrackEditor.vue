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

const rootEl = ref<HTMLDivElement>()
const editorEl = ref<HTMLDivElement>()
// Backdrop canvas — sits behind the (transparent) editor text so
// @strudel/draw visuals render the way strudel.cc shows them.
const canvasEl = ref<HTMLCanvasElement>()
const colorMode = useColorMode()

let editor: StrudelEditor | undefined
let ready: Promise<StrudelEditor> | undefined
let resizeObserver: ResizeObserver | undefined
// While applying code that came from outside this editor (a WebSocket
// relay), the factory's own guard suppresses the echo — this flag is a
// second guard for the props.code watcher itself.
let applyingExternal = false

// Keep the canvas's pixel buffer matched to its displayed size —
// @strudel/draw's painters lay out against canvas.width / height.
function syncCanvasSize() {
  const c = canvasEl.value
  const host = rootEl.value
  if (!c || !host) return
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(host.clientWidth * dpr))
  const h = Math.max(1, Math.round(host.clientHeight * dpr))
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
}

onMounted(() => {
  syncCanvasSize()
  resizeObserver = new ResizeObserver(syncCanvasSize)
  if (rootEl.value) resizeObserver.observe(rootEl.value)

  ready = createStrudelEditor({
    root: editorEl.value!,
    drawContext: canvasEl.value?.getContext('2d', { willReadFrequently: true }) ?? null,
    initialCode: props.code,
    editable: props.editable,
    onCodeChange: (code) => {
      if (!applyingExternal) emit('update:code', code)
    },
    onError: error => emit('update:error', error),
    onRequestPlay: () => emit('requestPlay'),
    onRequestStop: () => emit('requestStop'),
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
  resizeObserver?.disconnect()
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
  <div ref="rootEl" class="bg-elevated relative flex min-h-0 flex-col overflow-hidden rounded-md">
    <canvas
      ref="canvasEl"
      class="pointer-events-none absolute inset-0 z-0 size-full"
      aria-hidden="true"
      data-testid="track-canvas"
    />
    <div ref="editorEl" class="relative z-10 min-h-0 flex-1 overflow-hidden" />
  </div>
</template>

<style scoped>
:deep(.cm-editor) {
  height: 100%;
  background: transparent;
}

:deep(.cm-scroller) {
  overflow: auto;
}

:deep(.cm-gutters) {
  background: transparent;
}
</style>
