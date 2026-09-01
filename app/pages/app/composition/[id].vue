<script setup lang="ts">
import type { CompositionPresenceEntry, Role } from '#shared/compositionProtocol'
import type { CompositionProvider } from '~/lib/compositionProvider'
import type { StrudelEditor } from '~/lib/strudelEditor'
import { StateEffect } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import { nextCycleBoundary } from '#shared/transportMath'
import { createCompositionProvider } from '~/lib/compositionProvider'
import { createStrudelEditor, primeAudio } from '~/lib/strudelEditor'
import { waitForCycleBoundary } from '~/lib/transportClock'

// Immersive full-screen tool view — no dashboard chrome, same as a JAM
// room.
definePageMeta({ layout: false })

useSeoMeta({ title: 'Composition Room — jaime' })

const route = useRoute()
const roomId = computed(() => String(route.params.id))

const { displayName, setDisplayName } = useDisplayName()
const nameInput = ref('')
function submitName() {
  setDisplayName(nameInput.value)
}

// Self-declared, one link, no server-enforced access control — see
// design.md decision 4. Chosen on join, switchable in-room.
const role = ref<Role>()
function chooseRole(next: Role) {
  role.value = next
}

// Seed only used when the very first person enters a brand-new room; an
// existing room's document arrives over Yjs and this is ignored.
const STARTER_DOC = `// One shared script — everyone in this room edits it together.
// Ctrl-Enter evaluates for the whole room; Ctrl-. stops.
$: s("bd*4, ~ cp*<1 2>").bank("RolandTR909")
$: note("<c2 eb2 g2 bb1>").s("sawtooth").lpf(sine.range(400, 1400).slow(8)).lpq(6).gain(.7)
`

const rootEl = ref<HTMLDivElement>()
const editorEl = ref<HTMLDivElement>()
// Backdrop canvas — @strudel/draw visuals render behind the transparent
// editor text, the way strudel.cc shows them.
const canvasEl = ref<HTMLCanvasElement>()
const colorMode = useColorMode()

const audioUnlocked = ref(false)
const connected = ref(false)
const playing = ref(false)
const error = ref<string | null>(null)
const linkCopied = ref(false)
const participants = ref<CompositionPresenceEntry[]>([])

const isEditor = computed(() => role.value === 'editor')

let provider: CompositionProvider | undefined
let editor: StrudelEditor | undefined
let undoManager: Y.UndoManager | undefined
let resizeObserver: ResizeObserver | undefined

// Keep the canvas pixel buffer matched to its displayed size —
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

async function copyInviteLink() {
  await navigator.clipboard.writeText(window.location.href)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 1500)
}

// Evaluate / stop are broadcast, not run locally — the server relays an
// `eval` / `stop` back to everyone (this client included) and the
// provider events below drive the actual repl, so editors and viewers
// start together on the next shared cycle boundary. Only an editor
// originates one.
function requestEval() {
  if (!provider || !isEditor.value) return
  const clock = provider.getClock()
  const atCycle = nextCycleBoundary(clock.cycleStartTimestamp, clock.bpm, Date.now() + provider.getOffset())
  provider.sendEval(atCycle)
}
function requestStop() {
  if (isEditor.value) provider?.sendStop()
}

// Switch role live — reconfigure the editable compartment and tell the
// room; no rejoin (design.md decision 4).
function toggleRole() {
  const next: Role = isEditor.value ? 'viewer' : 'editor'
  role.value = next
  provider?.setRole(next)
  editor?.setEditable(next === 'editor')
}

async function start() {
  if (!displayName.value || !role.value || provider) return
  await nextTick() // the room shell (and its refs) render once the gates clear

  // Don't block editor mount on this — browsers only resume the
  // AudioContext on a genuine gesture, so it may not settle until the
  // user clicks something (the unlock banner covers that wait).
  void primeAudio().then(() => { audioUnlocked.value = true })

  syncCanvasSize()
  resizeObserver = new ResizeObserver(syncCanvasSize)
  if (rootEl.value) resizeObserver.observe(rootEl.value)

  provider = createCompositionProvider({
    roomId: roomId.value,
    name: displayName.value,
    role: role.value,
  })
  provider.on('status', (c) => { connected.value = c })
  provider.on('playing', (p) => { playing.value = p })
  provider.on('presence', (roster) => { participants.value = roster })
  provider.on('eval', () => { playing.value = true; void editor?.evaluate() })
  provider.on('stop', () => { playing.value = false; editor?.stop() })

  await provider.ready

  editor = await createStrudelEditor({
    root: editorEl.value!,
    drawContext: canvasEl.value?.getContext('2d', { willReadFrequently: true }) ?? null,
    initialCode: provider.text.length > 0 ? provider.text.toString() : STARTER_DOC,
    editable: isEditor.value,
    // Align every scheduler start to this room's shared cycle grid,
    // using the provider's own ping/pong offset (a client that came
    // straight here never ran JAM's offset estimate).
    beforeStart: () => {
      const clock = provider!.getClock()
      return waitForCycleBoundary(clock.cycleStartTimestamp, clock.bpm, provider!.getOffset())
    },
    onError: (e) => { error.value = e },
    onRequestPlay: requestEval,
    onRequestStop: requestStop,
  })

  // First person into a fresh room seeds the shared document. The length
  // check makes a same-instant double-entry the only race, and it only
  // duplicates this canned text — no edits are lost. A viewer never
  // seeds (they can't originate document changes).
  if (isEditor.value && provider.text.length === 0) {
    provider.text.insert(0, STARTER_DOC)
  }

  // yCollab makes the Y.Text authoritative for the editor and brings
  // collaborative undo + remote selections (name + colour per peer).
  // Appended the same way TrackEditor appends its editable compartment;
  // it stays attached for viewers so they receive edits, they just
  // can't originate them.
  undoManager = new Y.UndoManager(provider.text)
  editor.view.dispatch({
    effects: StateEffect.appendConfig.of(yCollab(provider.text, provider.awareness, { undoManager })),
  })

  // @strudel/codemirror's initTheme() forces `dark` on <html>; re-assert
  // the app's real colour mode so the surrounding shell isn't dragged.
  document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
  document.documentElement.classList.toggle('light', colorMode.value === 'light')
}

onMounted(() => { void start() })
watch([displayName, role], () => { void start() })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  editor?.destroy()
  undoManager?.destroy()
  provider?.destroy()
})
</script>

<template>
  <div v-if="!displayName" class="flex h-screen flex-col items-center justify-center gap-4 p-4">
    <h1 class="text-xl font-semibold">
      What should we call you?
    </h1>
    <div class="flex w-full max-w-sm gap-2">
      <UInput
        v-model="nameInput"
        data-testid="display-name-input"
        placeholder="Your name"
        class="flex-1"
        autofocus
        @keyup.enter="submitName"
      />
      <UButton data-testid="submit-name-button" @click="submitName">
        Next
      </UButton>
    </div>
  </div>

  <div v-else-if="!role" class="flex h-screen flex-col items-center justify-center gap-4 p-4">
    <h1 class="text-xl font-semibold">
      Join as…
    </h1>
    <p class="text-muted max-w-sm text-center text-sm">
      Editors change the shared script; viewers follow along and hear
      playback. You can switch any time.
    </p>
    <div class="flex gap-2">
      <UButton data-testid="role-editor" @click="chooseRole('editor')">
        Editor
      </UButton>
      <UButton data-testid="role-viewer" color="neutral" variant="outline" @click="chooseRole('viewer')">
        Viewer
      </UButton>
    </div>
  </div>

  <div v-else class="flex h-screen flex-col gap-3 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <NuxtLink to="/" aria-label="jaime home">
        <Logo size="sm" />
      </NuxtLink>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :color="connected ? 'success' : 'neutral'"
          variant="subtle"
          data-testid="connection-status"
        >
          {{ connected ? 'Connected' : 'Connecting…' }}
        </UBadge>
        <UButton
          v-if="isEditor"
          size="xs"
          :color="playing ? 'neutral' : 'success'"
          :variant="playing ? 'outline' : 'solid'"
          data-testid="play-stop-button"
          @click="playing ? requestStop() : requestEval()"
        >
          {{ playing ? 'Stop' : 'Play' }}
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          data-testid="toggle-role-button"
          @click="toggleRole"
        >
          {{ isEditor ? 'Switch to viewer' : 'Switch to editor' }}
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="outline"
          data-testid="copy-invite-button"
          @click="copyInviteLink"
        >
          {{ linkCopied ? 'Copied!' : 'Copy invite link' }}
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="!audioUnlocked"
      data-testid="audio-unlock-banner"
      color="warning"
      variant="subtle"
      title="Tap anywhere to enable audio"
      description="Your browser blocks sound until you interact with the page."
    />
    <UAlert
      v-if="error"
      color="error"
      title="Pattern error"
      :description="error"
      :close="{ onClick: () => (error = null) }"
    />

    <div class="flex min-h-0 flex-1 gap-3">
      <div
        ref="rootEl"
        class="bg-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md"
        data-testid="composition-editor"
      >
        <canvas
          ref="canvasEl"
          class="pointer-events-none absolute inset-0 z-0 size-full"
          aria-hidden="true"
          data-testid="composition-canvas"
        />
        <div ref="editorEl" class="relative z-10 min-h-0 flex-1 overflow-hidden" />
      </div>

      <aside
        class="hidden w-48 shrink-0 flex-col gap-1.5 overflow-y-auto sm:flex"
        data-testid="participants"
      >
        <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
          In the room ({{ participants.length }})
        </h2>
        <div
          v-for="p in participants"
          :key="p.clientId"
          class="flex items-center justify-between gap-2 text-sm"
          data-testid="participant"
        >
          <span class="truncate">{{ p.name }}</span>
          <UBadge
            size="xs"
            :color="p.role === 'editor' ? 'primary' : 'neutral'"
            variant="subtle"
          >
            {{ p.role }}
          </UBadge>
        </div>
      </aside>
    </div>
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
