<script setup lang="ts">
import type { AsciiArtPiece } from '#shared/asciiArt'
import type { ChatMessage, CompositionPresenceEntry, Role } from '#shared/compositionProtocol'
import type { CompositionProvider } from '~/lib/compositionProvider'
import type { StrudelEditor } from '~/lib/strudelEditor'
import { StateEffect } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import { nextCycleBoundary } from '#shared/transportMath'
import { COMPOSITION_PRESETS } from '~/lib/compositionPresets'
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

// add-ascii-overlay slice 3: a per-viewer-random batch fetched once
// (and refilled when exhausted) so the beat-driven swap never depends
// on network latency — see design.md ("Selection: ORDER BY RANDOM()
// server-side, batched client-side").
const ASCII_BATCH_SIZE = 30
const SWAP_INTERVAL_KEY = 'jaime:ascii-swap-interval'
const SWAP_INTERVAL_MIN = 1
const SWAP_INTERVAL_MAX = 64
const DEFAULT_SWAP_INTERVAL = 4

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
const { label: shareLabel, copied: linkCopied, share } = useShareLink()
const participants = ref<CompositionPresenceEntry[]>([])
const chat = ref<ChatMessage[]>([])
const chatInput = ref('')
const chatLog = ref<HTMLDivElement>()
// The people/chat panel docks beside the editor on wide screens and
// overlays on demand on narrow ones (a landscape phone shouldn't lose a
// third of its width to it). Default open only when there's room.
const panelOpen = ref(true)
const unread = ref(0)

// The ASCII-art panel (add-ascii-overlay) is independent of the chat
// panel above and off by default. Below `md` both become full-width
// overlay sheets, so only one is shown at a time there; on `md`+ both
// may dock side by side.
const showAsciiPanel = ref(false)
const asciiBodyEl = ref<HTMLDivElement>()
const asciiFontSize = ref(16)
const asciiBatch = ref<AsciiArtPiece[]>([])
const asciiCursor = ref(0)
const asciiLoadError = ref(false)
const currentAsciiArt = computed<AsciiArtPiece | null>(() => asciiBatch.value[asciiCursor.value] ?? null)
// Every piece has different character dimensions — refit on every
// change, not just when a fresh batch is fetched (a plain cursor
// advance within an already-loaded batch used to skip this, letting
// the font size drift wildly oversized on some swaps).
watch(currentAsciiArt, () => { void nextTick(syncAsciiFontSize) })
// Per-viewer only — never sent over the WS connection or stored in
// room state (design.md: swap cadence is a personal preference, not
// something the room needs to agree on).
const swapInterval = ref(DEFAULT_SWAP_INTERVAL)

const isEditor = computed(() => role.value === 'editor')

async function fetchAsciiBatch() {
  try {
    const batch = await $fetch<AsciiArtPiece[]>('/api/ascii-art/random', { query: { count: ASCII_BATCH_SIZE } })
    asciiBatch.value = batch
    asciiCursor.value = 0
    asciiLoadError.value = false
  }
  catch {
    // Scrape hasn't run yet locally, or a transient network blip —
    // the panel shows a quiet placeholder rather than an error banner.
    asciiLoadError.value = true
  }
}

/** Advances to the next piece in the current batch, refilling from the
 *  API once the batch is exhausted (keeps showing the last piece until
 *  the refill resolves — no flicker to empty). */
function advanceAsciiArt() {
  if (asciiBatch.value.length === 0) {
    void fetchAsciiBatch()
    return
  }
  const next = asciiCursor.value + 1
  if (next >= asciiBatch.value.length) {
    void fetchAsciiBatch()
    return
  }
  asciiCursor.value = next
}

function loadStoredSwapInterval(): number {
  try {
    const raw = Number.parseInt(localStorage.getItem(SWAP_INTERVAL_KEY) ?? '', 10)
    return Number.isFinite(raw) && raw >= SWAP_INTERVAL_MIN && raw <= SWAP_INTERVAL_MAX ? raw : DEFAULT_SWAP_INTERVAL
  }
  catch {
    return DEFAULT_SWAP_INTERVAL
  }
}

function adjustSwapInterval(delta: number) {
  swapInterval.value = Math.min(SWAP_INTERVAL_MAX, Math.max(SWAP_INTERVAL_MIN, swapInterval.value + delta))
  try {
    localStorage.setItem(SWAP_INTERVAL_KEY, String(swapInterval.value))
  }
  catch { /* private browsing etc. — the setting just won't persist */ }
}

// Beat-driven swap loop: a plain wall-clock timer derived from the
// room's own bpm, not a hook into Strudel's internal scheduler (which,
// per investigation, doesn't expose a per-hap callback to host apps —
// see design.md). Runs only while playing; a fresh loop starts on
// every play so it always uses the current bpm.
let asciiSwapTimer: ReturnType<typeof setInterval> | undefined
let beatsSinceSwap = 0
let lastBeatAt = 0

function stopAsciiSwapLoop() {
  if (asciiSwapTimer) clearInterval(asciiSwapTimer)
  asciiSwapTimer = undefined
}

function startAsciiSwapLoop() {
  stopAsciiSwapLoop()
  const bpm = provider?.getClock().bpm || 120
  const beatMs = 60000 / bpm
  beatsSinceSwap = 0
  lastBeatAt = performance.now()
  asciiSwapTimer = setInterval(() => {
    const now = performance.now()
    while (now - lastBeatAt >= beatMs) {
      lastBeatAt += beatMs
      beatsSinceSwap += 1
      if (beatsSinceSwap >= swapInterval.value) {
        beatsSinceSwap = 0
        advanceAsciiArt()
      }
    }
  }, 50)
}

watch(playing, (isPlaying) => {
  if (isPlaying) startAsciiSwapLoop()
  else stopAsciiSwapLoop()
})

function isWideViewport(): boolean {
  return window.matchMedia?.('(min-width: 768px)')?.matches ?? true
}

function togglePanel() {
  panelOpen.value = !panelOpen.value
  if (panelOpen.value) {
    unread.value = 0
    if (!isWideViewport()) showAsciiPanel.value = false
  }
}

function toggleAsciiPanel() {
  showAsciiPanel.value = !showAsciiPanel.value
  if (showAsciiPanel.value) {
    if (!isWideViewport()) panelOpen.value = false
    if (asciiBatch.value.length === 0) void fetchAsciiBatch()
    void nextTick(syncAsciiFontSize)
  }
}

function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  provider?.sendChat(text)
  chatInput.value = ''
}

// One-click starter compositions — replace the whole shared document
// (an editor-only, collaborative action: every participant's editor
// follows via Yjs). The `Y.Doc` transaction makes it one undo step.
function loadPreset(code: string) {
  if (!provider || !isEditor.value) return
  const text = provider.text
  provider.ydoc.transact(() => {
    text.delete(0, text.length)
    text.insert(0, code)
  })
}

const presetItems = computed(() => [
  COMPOSITION_PRESETS.map(p => ({
    label: p.title,
    description: p.credit,
    icon: 'i-lucide-music',
    onSelect: () => loadPreset(p.code),
  })),
])

// Below `sm` the secondary header controls collapse into one "⋯" menu
// so a phone header stays a single compact row.
const overflowItems = computed(() => {
  const group: Record<string, unknown>[] = []
  if (isEditor.value) {
    group.push({ label: 'Load a starter', icon: 'i-lucide-library-big', children: presetItems.value[0] })
  }
  group.push({
    label: isEditor.value ? 'Switch to viewer' : 'Switch to editor',
    icon: 'i-lucide-repeat',
    onSelect: toggleRole,
  })
  group.push({ label: shareLabel.value, icon: 'i-lucide-share-2', onSelect: shareInvite })
  return [group]
})

let provider: CompositionProvider | undefined
let editor: StrudelEditor | undefined
let undoManager: Y.UndoManager | undefined
let resizeObserver: ResizeObserver | undefined
let asciiResizeObserver: ResizeObserver | undefined
let wrapDebounce: ReturnType<typeof setTimeout> | undefined

const ASCII_FONT_MIN = 6
const ASCII_FONT_MAX = 48
// Rough monospace glyph metrics — good enough to fit text to the pane
// without measuring the DOM (design.md decision: "computed, not
// measured").
const ASCII_CHAR_WIDTH_EM = 0.6
const ASCII_LINE_HEIGHT_EM = 1.15

// Fits the current piece to the panel's available space, independent
// of the backdrop canvas's own ResizeObserver below.
function syncAsciiFontSize() {
  const el = asciiBodyEl.value
  const art = currentAsciiArt.value
  if (!el || !art || el.clientWidth <= 0 || el.clientHeight <= 0) return
  const byWidth = el.clientWidth / (art.width * ASCII_CHAR_WIDTH_EM)
  const byHeight = el.clientHeight / (art.height * ASCII_LINE_HEIGHT_EM)
  asciiFontSize.value = Math.min(ASCII_FONT_MAX, Math.max(ASCII_FONT_MIN, Math.floor(Math.min(byWidth, byHeight))))
}

// Below this editor-host width the editor soft-wraps so code is read by
// scrolling vertically, never horizontally (Tailwind `sm`).
const WRAP_BELOW = 640
let wrapping = false

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

function applyWrapping() {
  const host = rootEl.value
  if (!host) return
  const next = host.clientWidth < WRAP_BELOW
  if (next === wrapping) return
  wrapping = next
  editor?.setLineWrapping(next)
}

function onResize() {
  syncCanvasSize()
  clearTimeout(wrapDebounce)
  wrapDebounce = setTimeout(applyWrapping, 150)
}

function shareInvite() {
  void share(window.location.href, 'Join my Composition Room on jaime')
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

  // scope() / spectrum() / pitchwheel() / spiral() bypass StrudelMirror's
  // drawContext and call @strudel/draw's getDrawContext(), which
  // otherwise prepends a position:fixed, full-viewport
  // `<canvas id="test-canvas">` to <body> — visuals then bleed across the
  // whole page (under the panel, above the editor). Claim that id for our
  // clipped backdrop canvas so they draw inside the editor pane like
  // punchcard does; drop any stale fixed one a previous room left behind.
  document.querySelectorAll('canvas#test-canvas').forEach((c) => {
    if (c !== canvasEl.value) c.remove()
  })
  if (canvasEl.value) canvasEl.value.id = 'test-canvas'

  syncCanvasSize()
  resizeObserver = new ResizeObserver(onResize)
  if (rootEl.value) resizeObserver.observe(rootEl.value)

  syncAsciiFontSize()
  asciiResizeObserver = new ResizeObserver(syncAsciiFontSize)
  if (asciiBodyEl.value) asciiResizeObserver.observe(asciiBodyEl.value)

  provider = createCompositionProvider({
    roomId: roomId.value,
    name: displayName.value,
    role: role.value,
  })
  // `playing` fires once from the welcome (before the editor exists) and
  // again on later broadcasts — remember it so a late joiner can start
  // its own repl right after the editor is built (4.2).
  let playingOnJoin = false
  provider.on('status', (c) => { connected.value = c })
  provider.on('playing', (p) => { playing.value = p; playingOnJoin = p })
  provider.on('presence', (roster) => { participants.value = roster })
  provider.on('chat', (msg) => {
    chat.value.push(msg)
    if (!panelOpen.value) unread.value++
    void nextTick(() => { if (chatLog.value) chatLog.value.scrollTop = chatLog.value.scrollHeight })
  })
  // Every client — editors and viewers — evaluates its own copy of the
  // shared document, aligned to the room clock by the editor's
  // beforeStart. The broadcast carries only { atCycle }, never code.
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
  wrapping = (rootEl.value?.clientWidth ?? WRAP_BELOW) < WRAP_BELOW
  editor.setLineWrapping(wrapping)

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

  // Joined a room that's already playing — start this client's repl on
  // the current document, locked to the same clock, with no one
  // re-triggering (4.2).
  if (playingOnJoin) {
    playing.value = true
    void editor.evaluate()
  }
}

onMounted(() => {
  panelOpen.value = window.matchMedia?.('(min-width: 768px)')?.matches ?? true
  swapInterval.value = loadStoredSwapInterval()
  void start()
})
watch([displayName, role], () => { void start() })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  asciiResizeObserver?.disconnect()
  stopAsciiSwapLoop()
  clearTimeout(wrapDebounce)
  canvasEl.value?.removeAttribute('id')
  editor?.destroy()
  undoManager?.destroy()
  provider?.destroy()
})
</script>

<template>
  <div v-if="!displayName" class="flex h-dvh flex-col items-center justify-center gap-4 p-4">
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

  <div v-else-if="!role" class="flex h-dvh flex-col items-center justify-center gap-4 p-4">
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

  <div v-else class="flex h-dvh flex-col gap-3 p-4">
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

        <!-- Secondary controls: inline at sm+, folded into the ⋯ menu below. -->
        <span class="hidden items-center gap-2 sm:flex">
          <UDropdownMenu v-if="isEditor" :items="presetItems" :content="{ align: 'end' }">
            <UButton
              size="xs"
              color="neutral"
              variant="outline"
              icon="i-lucide-library-big"
              trailing-icon="i-lucide-chevron-down"
              data-testid="load-preset-button"
            >
              Load a starter
            </UButton>
          </UDropdownMenu>
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
            @click="shareInvite"
          >
            {{ linkCopied ? 'Copied!' : shareLabel }}
          </UButton>
        </span>
        <UDropdownMenu :items="overflowItems" :content="{ align: 'end' }" class="sm:hidden">
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-ellipsis"
            aria-label="More room controls"
            data-testid="room-overflow-menu"
          />
        </UDropdownMenu>

        <UButton
          size="xs"
          color="neutral"
          :variant="showAsciiPanel ? 'solid' : 'outline'"
          icon="i-lucide-scroll-text"
          aria-label="Toggle ASCII art panel"
          data-testid="toggle-ascii-panel-button"
          @click="toggleAsciiPanel"
        />

        <UButton
          size="xs"
          :color="unread ? 'primary' : 'neutral'"
          :variant="panelOpen ? 'solid' : 'outline'"
          icon="i-lucide-users"
          data-testid="toggle-panel-button"
          @click="togglePanel"
        >
          {{ participants.length }}<span v-if="unread"> · {{ unread }} new</span>
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

    <div class="relative flex min-h-0 flex-1 gap-3">
      <div
        ref="rootEl"
        class="bg-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md"
        :class="showAsciiPanel ? 'md:w-64 md:flex-none lg:w-96' : ''"
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

      <!-- Docked beside the editor on md+ (solid background at every size,
           unlike the chat panel below, which goes transparent on md+).
           Takes the lion's share of the row — the editor shrinks to a
           fixed width instead — since the art is the point once this is
           open; a right-hand overlay sheet below md. Independent of the
           chat panel's toggle — see add-ascii-overlay design.md. -->
      <aside
        v-show="showAsciiPanel"
        class="bg-elevated border-default absolute inset-y-0 right-0 z-30 flex min-h-0 w-72 max-w-[85vw] shrink-0 flex-col gap-2 rounded-l-md border-l p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:static md:min-w-0 md:max-w-none md:flex-1 md:rounded-md md:border md:shadow-none"
        data-testid="ascii-panel"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
            ASCII art
          </h2>
          <div class="flex items-center gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-shuffle"
              aria-label="Show another piece now"
              data-testid="ascii-shuffle-button"
              @click="advanceAsciiArt"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="md:hidden"
              data-testid="close-ascii-panel-button"
              @click="showAsciiPanel = false"
            />
          </div>
        </div>

        <!-- Per-viewer only — never synced to other participants; see
             add-ascii-overlay design.md. -->
        <div class="text-muted flex items-center justify-center gap-1.5 text-xs">
          <span>swap every</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-minus"
            aria-label="Swap less often"
            data-testid="ascii-interval-decrease"
            @click="adjustSwapInterval(-1)"
          />
          <span class="w-5 text-center tabular-nums" data-testid="ascii-interval-value">{{ swapInterval }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            aria-label="Swap more often"
            data-testid="ascii-interval-increase"
            @click="adjustSwapInterval(1)"
          />
          <span>beats</span>
        </div>

        <div
          ref="asciiBodyEl"
          class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black"
          data-testid="ascii-art-body"
        >
          <pre
            v-if="currentAsciiArt"
            class="whitespace-pre text-center font-mono leading-tight text-white"
            :style="{ fontSize: `${asciiFontSize}px` }"
            data-testid="ascii-art-text"
          >{{ currentAsciiArt.text }}</pre>
          <p v-else class="text-xs text-white/60">
            {{ asciiLoadError ? 'No ASCII art available yet.' : 'Loading…' }}
          </p>
        </div>

        <a
          v-if="currentAsciiArt"
          :href="currentAsciiArt.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted hover:text-default truncate text-xs underline-offset-2 hover:underline"
          data-testid="ascii-attribution"
        >
          {{ currentAsciiArt.title ?? 'Untitled' }} — {{ currentAsciiArt.artist ?? 'unknown artist' }}
        </a>
      </aside>

      <!-- Docked beside the editor on md+; a right-hand overlay sheet below that. -->
      <aside
        v-show="panelOpen"
        class="bg-elevated border-default absolute inset-y-0 right-0 z-30 flex w-72 max-w-[85vw] shrink-0 flex-col gap-3 rounded-l-md border-l p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:static md:w-56 md:max-w-none md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pb-0 md:shadow-none"
        data-testid="side-panel"
      >
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="self-end md:hidden"
          data-testid="close-panel-button"
          @click="panelOpen = false"
        />
        <div class="flex flex-col gap-1.5" data-testid="participants">
          <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
            In the room ({{ participants.length }})
          </h2>
          <div
            v-for="p in participants"
            :key="p.clientId"
            class="flex items-center gap-2 text-sm"
            data-testid="participant"
          >
            <UserAvatar :name="p.name" :src="p.avatarUrl" />
            <span class="min-w-0 flex-1 truncate">{{ p.name }}</span>
            <UBadge
              size="xs"
              :color="p.role === 'editor' ? 'primary' : 'neutral'"
              variant="subtle"
            >
              {{ p.role }}
            </UBadge>
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-1.5" data-testid="chat">
          <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
            Chat
          </h2>
          <div
            ref="chatLog"
            class="border-default min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border p-2 text-sm"
            data-testid="chat-log"
          >
            <p v-if="!chat.length" class="text-muted text-xs">
              Messages are visible to everyone here and aren't saved.
            </p>
            <div v-for="(m, i) in chat" :key="i" class="flex items-start gap-1.5" data-testid="chat-message-row">
              <UserAvatar :name="m.name" :src="m.avatarUrl" class="mt-0.5 shrink-0" />
              <p class="min-w-0" data-testid="chat-message">
                <span class="text-muted">{{ m.name }}:</span> {{ m.text }}
              </p>
            </div>
          </div>
          <div class="flex gap-1.5">
            <UInput
              v-model="chatInput"
              size="xs"
              placeholder="Message"
              class="flex-1"
              data-testid="chat-input"
              @keyup.enter="sendChat"
            />
            <UButton size="xs" color="neutral" data-testid="chat-send" @click="sendChat">
              Send
            </UButton>
          </div>
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
