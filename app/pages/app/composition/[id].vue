<script setup lang="ts">
import type { AsciiArtPiece } from '#shared/asciiArt'
import type { ChatMessage, CompositionPresenceEntry, JahAvailability, Role } from '#shared/compositionProtocol'
import type { Pattern, PatternListResult } from '#shared/catalog'
import type { CompositionProvider } from '~/lib/compositionProvider'
import type { StrudelEditor } from '~/lib/strudelEditor'
import { StateEffect } from '@codemirror/state'
import { yCollab } from 'y-codemirror.next'
import * as Y from 'yjs'
import { nextCycleBoundary } from '#shared/transportMath'
import type { ChatUIMessage } from '~/lib/chatMessages'
import type { ReplySegment } from '~/lib/chatSegments'
import { toChatMessages } from '~/lib/chatMessages'
import { splitReply } from '~/lib/chatSegments'
import { createCompositionProvider } from '~/lib/compositionProvider'
import { withJahMention } from '~/lib/jahMention'
import { createStrudelEditor, primeAudio } from '~/lib/strudelEditor'
import { randomDisplayName } from '~/lib/suggestedName'
import { toStrudelUrl } from '~/lib/strudelShareLink'
import { waitForCycleBoundary } from '~/lib/transportClock'

// Immersive full-screen tool view — no dashboard chrome, same as a JAM
// room.
definePageMeta({ layout: false })

useSeoMeta({ title: 'Composition Room — jaime' })

const route = useRoute()
const router = useRouter()
const roomId = computed(() => String(route.params.id))

const { displayName, setDisplayName } = useDisplayName()
const nameInput = ref(randomDisplayName())
// This route is `ssr:false` (nuxt.config.ts), so the SSR-only auth
// plugin (app/plugins/auth.ts) never runs for a direct/hard navigation
// here — a signed-in user's account name would otherwise never load,
// and they'd wrongly see the name-entry gate. Fetch it client-side.
const { user: authUser, refresh: refreshAuth } = useAuth()
function submitName() {
  setDisplayName(nameInput.value)
}

// Every joiner is automatically an editor — no UI choice
// (simplify-room-entry). `?role=viewer` keeps the viewer path
// genuinely reachable (and testable) without any button leading to
// it; nothing in the UI surfaces or hints at that link.
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
// Measures the sticky header's own real height (it varies: badges wrap on
// a narrow header, the context toolbar appears/disappears per tab) so the
// content area below it can be given an actual, definite height —
// `calc(100dvh - headerHeightPx)`. A definite height (not just `min-`) is
// what lets Composition/ASCII keep their fixed pane and lets Chat's
// message log bound itself and scroll internally in the normal case,
// while still growing past it (page scroll) when chat-log's own min-h-40
// genuinely doesn't fit (developer feedback, 2026-09-27) — flex-grow
// alone doesn't do this against a merely-`min-height` ancestor; once any
// content wants more room, everything just grows to fit it instead of
// clipping/scrolling. ResizeObserver (not a one-off snapshot) keeps this
// live and accurate.
const headerEl = ref<HTMLDivElement>()
const headerHeightPx = ref<number | null>(null)
let headerResizeObserver: ResizeObserver | undefined
const editorEl = ref<HTMLDivElement>()
// Backdrop canvas — @strudel/draw visuals render behind the transparent
// editor text, the way strudel.cc shows them.
const canvasEl = ref<HTMLCanvasElement>()
const colorMode = useColorMode()

// Roster is a floating overlay (a modal), not inline — kept closed by
// default so it doesn't eat mobile screen space, and a modal's own
// backdrop/focus-trap means it must be dismissed before the chat input
// underneath is reachable again.
const showRoster = ref(false)
const connected = ref(false)
const playing = ref(false)
const error = ref<string | null>(null)
const { label: shareLabel, copied: linkCopied, canShare, share, copyLink } = useShareLink()
const participants = ref<CompositionPresenceEntry[]>([])
const chat = ref<ChatMessage[]>([])
const chatInput = ref('')
const chatLog = ref<HTMLDivElement>()
// Whether the editor currently has a non-empty selection
// (add-jah-script-context) — drives the "selection attached" label next
// to the chat input; updated live by the editor's onSelectionChange, so
// it stays correct even after focus moves away from the editor.
const hasSelection = ref(false)
// @jah is generating a reply (add-jah-chat) — cleared once the reply
// (or a decline) lands, or immediately by the next 'jah_typing: false'.
const jahTyping = ref(false)
// This connection's id (from every `welcome`) — decides which chat
// messages are "mine" (uplift-chat-interface design decision 2).
const ownClientId = ref<string>()
// Whether @jah can reply to this participant, told at join. Until the
// first `welcome` arrives assume the most restrictive answer.
const jahAvailability = ref<JahAvailability>('signed-out')
// The "to @jah" switch: while on, outgoing messages get `@jah ` prepended.
// Sticky for the page session (not persisted), starts off.
const toJah = ref(false)
const JAH_UNAVAILABLE_HINT: Record<Exclude<JahAvailability, 'available'>, string> = {
  'signed-out': 'Sign in to talk to @jah.',
  'no-access': '@jah is invite-only.',
  'disabled': '@jah is offline.',
}
const jahHint = computed(() =>
  jahAvailability.value === 'available' ? '' : JAH_UNAVAILABLE_HINT[jahAvailability.value])
// A switch that can't work must not stay on (e.g. access lost on rejoin).
watch(jahAvailability, (a) => { if (a !== 'available') toJah.value = false })
const chatMessages = computed(() => toChatMessages(chat.value, ownClientId.value, jahTyping.value))
// UChatMessages' slot props are loosely typed (`metadata` is `unknown`,
// parts are a union) — narrow them to what toChatMessages produced.
const metaOf = (metadata: unknown) => metadata as ChatUIMessage['metadata']
const textOf = (parts: unknown) => (parts as ChatUIMessage['parts'])[0]?.text ?? ''
const toast = useToast()
// Model choice is a later change — the selector only says so.
function modelNotImplemented() {
  toast.add({
    title: 'Model selection isn’t available yet',
    description: 'For now @jah always uses its default model.',
    icon: 'i-lucide-info',
  })
}

// add-composition-tabs: Composition (editor + canvas), Chat (roster +
// messages), and ASCII Art are three mutually-exclusive tabs rather
// than independently-toggleable docked panels — exactly one is visible
// per viewer at a time, and the choice is local/unsynced (design.md).
type TabId = 'composition' | 'chat' | 'ascii'
// Chat is first and the default landing tab (add-jah-chat) — @jah
// lives there, including its one-time welcome message, so a new
// entrant sees it immediately rather than behind an extra click.
const activeTab = ref<TabId>('chat')
const TAB_DEFS: { id: TabId, label: string, icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'i-lucide-message-circle' },
  { id: 'composition', label: 'Composition', icon: 'i-lucide-code-2' },
  { id: 'ascii', label: 'ASCII Art', icon: 'i-lucide-scroll-text' },
]
// Per-tab activity indicators, cleared on switching to that tab.
// chatUnread existed before (moved off the old toggle button);
// compositionActivity is new.
const chatUnread = ref(0)
const compositionActivity = ref(false)

// Follow new messages only if the reader is already at (or near) the
// bottom, or the message is their own — never yank someone who has
// scrolled up to read.
const CHAT_STICK_PX = 80
function chatNearBottom(): boolean {
  const el = chatLog.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < CHAT_STICK_PX
}
function scrollChatToBottom() {
  void nextTick(() => { if (chatLog.value) chatLog.value.scrollTop = chatLog.value.scrollHeight })
}
// Measured in the pre-flush watcher, i.e. before the bubble is added.
watch(jahTyping, (typing) => { if (typing && chatNearBottom()) scrollChatToBottom() })

function setActiveTab(id: TabId) {
  activeTab.value = id
  if (id !== 'composition') confirmingClear.value = false
  if (id === 'chat') {
    chatUnread.value = 0
    // The panel was display:none, so anything that arrived meanwhile
    // sits below the fold.
    scrollChatToBottom()
  }
  if (id === 'composition') {
    compositionActivity.value = false
    // The editor pane is hidden (display:none) while another tab is
    // active, so its measured size goes stale — refresh on return.
    void nextTick(() => { syncCanvasSize(); applyWrapping() })
  }
  if (id === 'ascii') {
    if (asciiBatch.value.length === 0) void fetchAsciiBatch()
    void nextTick(syncAsciiFontSize)
  }
}

// Bare 1/2/3 switch tabs — ignored while typing in the editor or any
// text input, so a shortcut never steals a literal "1" from a pattern
// or a chat message.
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return !!el.closest('.cm-editor, input, textarea, [contenteditable="true"]')
}
function onKeydown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (isTypingTarget(e.target)) return
  const index = ['1', '2', '3'].indexOf(e.key)
  if (index === -1) return
  e.preventDefault()
  setActiveTab(TAB_DEFS[index]!.id)
}

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
// every play so it always uses the current bpm. Keeps running
// regardless of which tab is active — only the visual fitting is
// skipped while the ASCII Art tab isn't visible (see syncAsciiFontSize).
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

/**
 * The current selection's text, read fresh at send time (never cached
 * from the `hasSelection` label's own state) — `undefined` for no
 * selection, never an empty string (add-jah-script-context).
 */
function currentSelection(): { text: string } | undefined {
  const sel = editor?.view.state.selection.main
  if (!sel || sel.empty) return undefined
  return { text: editor!.view.state.sliceDoc(sel.from, sel.to) }
}

function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return
  provider?.sendChat(
    toJah.value && jahAvailability.value === 'available' ? withJahMention(text) : text,
    currentSelection(),
  )
  chatInput.value = ''
}

// One-click starter compositions — replace the whole shared document
// (an editor-only, collaborative action: every participant's editor
// follows via Yjs). The `Y.Doc` transaction makes it one undo step.
// Swapping in a whole new script while the old one is still playing
// would leave the room hearing stale audio for whatever's mid-loop —
// stop playback for everyone first and require an explicit Play.
function loadPreset(code: string) {
  if (!provider || !isEditor.value) return
  if (playing.value) requestStop()
  const text = provider.text
  provider.ydoc.transact(() => {
    text.delete(0, text.length)
    text.insert(0, code)
  })
}

// Composition Room starters are just favorited patterns from the
// pattern-library (add-favorite-patterns) — fetched once on mount,
// filtered client-side by the picker's own search box (the favorites
// list is a small curated showcase, not worth a request per keystroke).
const favoritePatterns = ref<Pattern[]>([])
async function loadFavoritePatterns() {
  try {
    const res = await $fetch<PatternListResult>('/api/patterns', { query: { favorite: true, limit: 60 } })
    favoritePatterns.value = res.patterns
  }
  catch {
    // Picker just shows nothing to pick — non-critical, no error banner.
  }
}

function sourceLabel(pattern: Pattern): string {
  if (pattern.source.author) return pattern.source.author
  try {
    return new URL(pattern.source.url).hostname.replace(/^www\./, '')
  }
  catch {
    return 'source'
  }
}

// Reset after every pick so the trigger keeps showing its placeholder
// rather than looking like a persistent "selected starter" control.
// `null`, not `undefined`: Reka treats an undefined model as uncontrolled and
// keeps showing the last pick. The template's `v-model.nullable` is what makes
// `null` a valid value for USelectMenu's types.
const starterPickerValue = ref<string | null>(null)
const starterItems = computed(() => favoritePatterns.value.map(p => ({
  label: p.title,
  description: sourceLabel(p),
  icon: 'i-lucide-music',
  value: p.id,
  onSelect: () => {
    loadPreset(p.code)
    // Reka UI applies its own v-model update around this same
    // selection event; resetting synchronously gets clobbered by it,
    // so wait a tick before clearing back to the placeholder.
    void nextTick(() => { starterPickerValue.value = null })
  },
})))

// "Open in strudel.cc" links the room's *current* document (whatever's
// live right now), not just a freshly-loaded starter.
function openCurrentInStrudel() {
  if (!provider) return
  window.open(toStrudelUrl(provider.text.toString()), '_blank', 'noopener')
}

// Blanks the shared document for everyone — same collaborative-action
// path as loadPreset, just with nothing to insert. Destructive and
// irreversible across clients, so it's role-gated and requires an
// explicit confirm step (design.md), mirroring the account page's
// inline confirm/cancel pattern rather than a modal.
const confirmingClear = ref(false)
function clearDocument() {
  if (!provider || !isEditor.value) return
  if (playing.value) requestStop()
  const text = provider.text
  provider.ydoc.transact(() => {
    text.delete(0, text.length)
  })
  confirmingClear.value = false
}

// Below `sm` the secondary header controls collapse into one "⋯" menu
// so a phone header stays a single compact row.
const overflowItems = computed(() => [[
  { label: shareLabel.value, icon: 'i-lucide-share-2', onSelect: shareInvite },
  ...(canShare.value ? [{ label: 'Copy invite link', icon: 'i-lucide-link', onSelect: copyInviteLink }] : []),
  { label: 'Open in strudel.cc', icon: 'i-lucide-external-link', onSelect: openCurrentInStrudel },
]])

let provider: CompositionProvider | undefined
// `start()`'s own guard checks `provider`, but that's only assigned
// after an `await nextTick()` (and more) — a real gap, not merely
// theoretical: displayName can change value twice shortly after mount
// for a signed-in user whose browser already has a leftover anonymous
// session name (sessionName resolves first, then the account name
// replaces it once refreshAuth() resolves), firing the `watch` below
// a second time before the first start() has assigned `provider`.
// Both calls then pass the guard and each open a real connection —
// the same account joins twice. `starting` closes the gap: it's set
// synchronously, before any await, so a second call arriving at any
// point before `provider` exists still sees it and bails.
let starting = false
let editor: StrudelEditor | undefined
let undoManager: Y.UndoManager | undefined
let resizeObserver: ResizeObserver | undefined
let asciiResizeObserver: ResizeObserver | undefined
let wrapDebounce: ReturnType<typeof setTimeout> | undefined

const ASCII_FONT_MIN = 6
const ASCII_FONT_MAX = 48
// Rough monospace glyph metrics — good enough to fit text to the pane
// without measuring the DOM (design.md decision: "computed, not
// measured"). CHAR_WIDTH is deliberately conservative (measured
// ui-monospace advance is closer to 0.55em; 0.6 undershoots slightly,
// which is safe). LINE_HEIGHT must match the `<pre>`'s actual
// `leading-tight` (1.25) exactly — a mismatch here compounds over many
// lines into real vertical overflow, unlike a per-character width slop.
const ASCII_CHAR_WIDTH_EM = 0.6
const ASCII_LINE_HEIGHT_EM = 1.25

// Fits the current piece to the panel's available space. A no-op while
// the ASCII Art tab isn't active — its host is display:none then, so
// clientWidth/Height read 0 and would otherwise corrupt the font size.
function syncAsciiFontSize() {
  if (activeTab.value !== 'ascii') return
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
// @strudel/draw's painters lay out against canvas.width / height. A
// no-op while the Composition tab isn't active, for the same
// display:none-reads-as-zero reason as syncAsciiFontSize above.
function syncCanvasSize() {
  if (activeTab.value !== 'composition') return
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
  if (activeTab.value !== 'composition') return
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

// On a device with a native share sheet, `shareInvite` opens the OS
// picker — there's no way to just grab the raw link without it. This
// is a second, direct path that's only shown alongside "Share" (when
// there's a share sheet to bypass); without one, the single button
// already copies directly.
function copyInviteLink() {
  copyLink(window.location.href)
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

// --- @jah code cards (add-jah-code-cards) ------------------------------------
// Previewing a card pauses the room for EVERYONE (design decision 4): stopping
// only the previewer would leave them out of sync with their mates. The stop
// is the ordinary broadcast — the server relays it, every editor's repl stops
// and `playing` goes false — so wait for that to land before the preview
// plays. Bounded, so a lost relay can't hang the Preview button.
function stopRoomForPreview(): Promise<void> {
  if (!playing.value) return Promise.resolve()
  requestStop()
  return new Promise((resolve) => {
    const finish = () => {
      unwatch()
      clearTimeout(timeout)
      resolve()
    }
    const unwatch = watch(playing, (p) => { if (!p) finish() })
    const timeout = setTimeout(finish, 2000)
  })
}

// At most 5 s, from when it starts playing; the room stays stopped after.
const preview = usePatternPreview({ beforeStart: stopRoomForPreview, maxMs: 5000 })

// Splitting parses Markdown; the chat re-renders often, so remember per text.
const segmentCache = new Map<string, ReplySegment[]>()
function segmentsOf(text: string): ReplySegment[] {
  let segments = segmentCache.get(text)
  if (!segments) {
    segments = splitReply(text)
    segmentCache.set(text, segments)
  }
  return segments
}

async function start() {
  if (!displayName.value || !role.value || provider || starting) return
  starting = true
  await nextTick() // the room shell (and its refs) render once the gates clear

  // Don't block editor mount on this — browsers only resume the
  // AudioContext on a genuine gesture, so it may not settle until the
  // user clicks something. No visible prompt for that wait (removed
  // per developer feedback, 2026-09-27): the room's own interactions
  // (submitting a display name, pressing Play, opening chat) already
  // provide that gesture in practice.
  void primeAudio()

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
  // Fires at the start of every `welcome`, which replays the whole log —
  // start it over so a reconnect doesn't show every message twice.
  provider.on('clientId', (id) => { ownClientId.value = id; chat.value = [] })
  provider.on('jah', (a) => { jahAvailability.value = a })
  provider.on('chat', (msg) => {
    const follow = msg.clientId === ownClientId.value || chatNearBottom()
    chat.value.push(msg)
    if (activeTab.value !== 'chat') chatUnread.value++
    if (follow) scrollChatToBottom()
  })
  provider.on('jahTyping', (typing) => { jahTyping.value = typing })
  // Every client — editors and viewers — evaluates its own copy of the
  // shared document, aligned to the room clock by the editor's
  // beforeStart. The broadcast carries only { atCycle }, never code.
  provider.on('eval', () => {
    // Someone pressed Play: it ends any running card preview, so two
    // sounds never overlap (add-jah-code-cards).
    void preview.stop()
    playing.value = true
    if (activeTab.value !== 'composition') compositionActivity.value = true
    void editor?.evaluate()
  })
  provider.on('stop', () => { playing.value = false; editor?.stop() })

  await provider.ready

  // ?load=<patternId> seeds a genuinely new room from a Pattern Library
  // pattern instead of the generic starter (simplify-room-entry) —
  // mirrors JAM's loader, but simpler: no ownership/claiming step,
  // since any editor can already write to the shared document.
  let seedCode = STARTER_DOC
  const loadId = route.query.load
  if (provider.text.length === 0 && typeof loadId === 'string' && loadId) {
    try {
      const pattern = await $fetch<{ code: string }>(`/api/patterns/${encodeURIComponent(loadId)}`)
      seedCode = pattern.code
    }
    catch {
      // Bad or missing pattern id — fall back to the generic starter
      // rather than leaving the room un-enterable.
    }
  }
  if (loadId) void router.replace({ query: {} }) // strip for a clean, shareable link

  editor = await createStrudelEditor({
    root: editorEl.value!,
    drawContext: canvasEl.value?.getContext('2d', { willReadFrequently: true }) ?? null,
    initialCode: provider.text.length > 0 ? provider.text.toString() : seedCode,
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
    onSelectionChange: (has) => { hasSelection.value = has },
  })
  wrapping = (rootEl.value?.clientWidth ?? WRAP_BELOW) < WRAP_BELOW
  editor.setLineWrapping(wrapping)

  // First person into a fresh room seeds the shared document. The length
  // check makes a same-instant double-entry the only race, and it only
  // duplicates this canned text — no edits are lost. A viewer never
  // seeds (they can't originate document changes).
  if (isEditor.value && provider.text.length === 0) {
    provider.text.insert(0, seedCode)
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

// headerEl only exists once the name gate clears (v-else branch) — watch
// rather than assume onMounted timing, and re-observe if it's ever torn
// down and recreated.
watch(headerEl, (el) => {
  headerResizeObserver?.disconnect()
  if (!el) return
  headerResizeObserver = new ResizeObserver(() => {
    headerHeightPx.value = el.getBoundingClientRect().height
  })
  headerResizeObserver.observe(el)
})

onMounted(() => {
  if (!authUser.value) void refreshAuth()
  swapInterval.value = loadStoredSwapInterval()
  window.addEventListener('keydown', onKeydown)
  void loadFavoritePatterns()
  chooseRole(route.query.role === 'viewer' ? 'viewer' : 'editor')
  void start()
})
watch([displayName, role], () => { void start() })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  headerResizeObserver?.disconnect()
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
  <div
    v-if="!displayName"
    class="flex h-dvh flex-col items-center justify-center gap-4 p-4"
  >
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

  <div
    v-else
    class="flex min-h-dvh flex-col gap-3 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]"
  >
    <!-- One sticky header (logo/status, tabs, context toolbar) instead of
         a top bar on desktop and a separate fixed bottom bar on mobile —
         always reachable while scrolling, on every screen size (developer
         feedback 2026-09-27: a short landscape view could squeeze the
         Chat tab's message log to almost nothing under the old "everything
         must fit in exactly one screen" layout; letting the page scroll,
         with the controls pinned, removes that failure mode entirely). -->
    <div ref="headerEl" class="bg-default sticky top-0 z-30 flex flex-col gap-3 pb-3" data-testid="room-header">
    <!-- Zone 1 — global identity & status: logo, connection/playback
         state, Play/Stop, Share. Always visible, constant across tabs. -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <NuxtLink to="/" aria-label="jaime home">
        <Logo size="sm" />
      </NuxtLink>
      <div class="flex flex-wrap items-center gap-2">
        <!-- Roster lives here — an always-visible badge shared with the
             other status chips, not a dedicated row inside the Chat tab
             (that cost real vertical space for no benefit, developer
             feedback 2026-09-27). Opens as a floating overlay; its own
             focus trap means it must be dismissed before the chat input
             behind it is reachable again. -->
        <UButton
          size="xs"
          color="neutral"
          variant="subtle"
          icon="i-lucide-users"
          data-testid="roster-toggle"
          @click="showRoster = true"
        >
          {{ participants.length }}
        </UButton>
        <UModal v-model:open="showRoster" title="In the room">
          <template #body>
            <div class="flex flex-col gap-2" data-testid="participants">
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
          </template>
        </UModal>
        <UBadge
          :color="connected ? 'success' : 'neutral'"
          variant="subtle"
          class="hidden sm:inline-flex"
          data-testid="connection-status"
        >
          {{ connected ? 'Connected' : 'Connecting…' }}
        </UBadge>
        <!-- Visible to editors and viewers alike, regardless of active
             tab — the only playback signal once the editor/canvas is
             just one tab among three. -->
        <UBadge
          :color="playing ? 'success' : 'neutral'"
          variant="subtle"
          data-testid="playback-status"
        >
          <UIcon :name="playing ? 'i-lucide-play' : 'i-lucide-square'" class="size-3" />
          {{ playing ? 'Playing' : 'Stopped' }}
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
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            data-testid="copy-invite-button"
            @click="shareInvite"
          >
            {{ linkCopied ? 'Copied!' : shareLabel }}
          </UButton>
          <!-- Only alongside "Share" (a device with a share sheet) —
               a direct path to the raw link without the OS picker. -->
          <UButton
            v-if="canShare"
            size="xs"
            color="neutral"
            variant="outline"
            :icon="linkCopied ? 'i-lucide-check' : 'i-lucide-link'"
            aria-label="Copy invite link"
            data-testid="copy-invite-link-button"
            @click="copyInviteLink"
          />
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-external-link"
            aria-label="Open in strudel.cc"
            data-testid="open-in-strudel-button"
            @click="openCurrentInStrudel"
          />
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
      </div>
    </div>

    <!-- Zone 2 — tab bar: one switcher, every screen size, inside the
         sticky header. overflow-x-auto so it scales past 3 tabs without
         wrapping on a narrow phone. -->
    <div class="border-default flex items-center gap-0.5 overflow-x-auto rounded-md border p-0.5" role="tablist" data-testid="tab-switcher">
      <UButton
        v-for="tab in TAB_DEFS"
        :key="tab.id"
        size="xs"
        :color="activeTab === tab.id ? 'primary' : 'neutral'"
        :variant="activeTab === tab.id ? 'solid' : 'ghost'"
        :icon="tab.icon"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :data-testid="`tab-${tab.id}`"
        @click="setActiveTab(tab.id)"
      >
        {{ tab.label }}
        <UBadge v-if="tab.id === 'chat' && chatUnread" size="xs" color="primary" variant="solid" class="ml-1">
          {{ chatUnread }}
        </UBadge>
        <span
          v-else-if="tab.id === 'composition' && compositionActivity"
          class="bg-primary ml-1 size-1.5 rounded-full"
          data-testid="composition-activity-dot"
        />
      </UButton>
    </div>

    <!-- Zone 3 — context toolbar: tab-specific controls. Not rendered
         at all when the active tab (for this participant's role) has
         none, so it costs zero space rather than an empty bar. -->
    <div
      v-if="(activeTab === 'composition' && isEditor) || activeTab === 'ascii'"
      class="flex flex-wrap items-center gap-2 border-b p-2"
      data-testid="context-toolbar"
    >
      <template v-if="activeTab === 'composition'">
        <USelectMenu
          v-model.nullable="starterPickerValue"
          :items="starterItems"
          value-key="value"
          placeholder="Load a starter"
          icon="i-lucide-library-big"
          size="xs"
          color="neutral"
          variant="outline"
          class="w-56"
          data-testid="load-preset-button"
        />

        <UButton
          v-if="!confirmingClear"
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-eraser"
          data-testid="clear-document-button"
          @click="confirmingClear = true"
        >
          Clear
        </UButton>
        <div v-else class="flex items-center gap-1.5 text-xs">
          <span class="text-muted">Clear for everyone?</span>
          <UButton size="xs" color="error" data-testid="clear-document-confirm" @click="clearDocument">
            Yes, clear
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" data-testid="clear-document-cancel" @click="confirmingClear = false">
            Cancel
          </UButton>
        </div>
      </template>

      <UButton
        v-else-if="activeTab === 'ascii'"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-shuffle"
        aria-label="Show another piece now"
        data-testid="ascii-shuffle-button"
        @click="advanceAsciiArt"
      >
        Shuffle
      </UButton>
    </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      title="Pattern error"
      :description="error"
      :close="{ onClick: () => (error = null) }"
    />

    <!-- flex-auto (`flex: 1 1 auto`), not flex-1 (`flex: 1 1 0%`): with a
         percentage flex-basis, an *indefinite* ancestor (root is
         min-h-dvh, not h-dvh) makes the basis resolve as `content` per
         spec, silently discarding the explicit height below — flex-auto's
         `auto` basis defers to it correctly instead. Confirmed in
         isolation; cost real time to track down (2026-09-27). -->
    <div
      class="relative flex min-h-0 flex-auto gap-3"
      :style="headerHeightPx ? { height: `calc(100dvh - ${headerHeightPx}px)` } : undefined"
    >
      <div
        v-show="activeTab === 'composition'"
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

      <!-- overflow-x-hidden here (not just on chat-log below) so the
           ancestor chain's own width doesn't grow to fit an unwrapped
           code block's natural width before chat-log ever gets a chance
           to clip it — CSS auto-upgrades this element's overflow-y to
           `auto` too (mixing `hidden` with the default `visible` on the
           other axis isn't representable), but that's inert now that the
           flex-basis fix above makes this box's own height genuinely
           bounded — its one child already fits without ever needing to
           actually scroll. -->
      <div
        v-show="activeTab === 'chat'"
        class="bg-elevated relative flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden rounded-md p-3"
        data-testid="chat-panel"
      >

        <div class="flex min-h-0 flex-1 flex-col gap-1.5" data-testid="chat">
          <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
            Chat
          </h2>
          <!-- Scrolls internally in the normal case (bounded between the
               sticky header above and the sticky input below — hence
               min-h-0 restored on this and its ancestors) — the log's own
               scrollTop, not the page, is what keeps the newest message in
               view (scrollChatToBottom()). `min-h-40` is only a floor for
               a tight viewport (short landscape): if header + input +
               that floor don't all fit, min-height wins and the page
               grows/scrolls instead of crushing the log (developer
               feedback, 2026-09-27). -->
          <div
            ref="chatLog"
            class="border-default bg-default min-h-40 flex-1 overflow-x-hidden overflow-y-auto rounded-md border py-2 text-sm"
            data-testid="chat-log"
          >
            <p v-if="!chat.length" class="text-muted px-3 text-xs">
              Messages are visible to everyone here and aren't saved.
            </p>
            <UChatMessages
              v-else
              compact
              :auto-scroll="false"
              :messages="chatMessages"
            >
              <template #header="{ metadata }">
                <span class="text-muted text-xs">{{ metaOf(metadata).name }}</span>
              </template>
              <template #content="{ metadata, parts }">
                <UChatShimmer v-if="metaOf(metadata).typing" text="@jah is thinking…" />
                <!-- Only @jah's replies get cards; a person's fenced code stays an ordinary code block. -->
                <div v-else-if="metaOf(metadata).jah" class="flex min-w-0 flex-col gap-2" data-testid="chat-message">
                  <template
                    v-for="(segment, i) in segmentsOf(textOf(parts))"
                    :key="`${metaOf(metadata).at}-${i}`"
                  >
                    <ChatMarkdown v-if="segment.kind === 'text'" :text="segment.text" />
                    <StrudelCard
                      v-else
                      :code="segment.code"
                      :can-preview="isEditor"
                      :previewing="preview.previewingId.value === `${metaOf(metadata).at}-${i}`"
                      :preview-loading="preview.loading.value"
                      :error="preview.error.value?.id === `${metaOf(metadata).at}-${i}` ? preview.error.value.message : null"
                      @pointerenter="preview.preload()"
                      @focusin="preview.preload()"
                      @preview="preview.toggle(`${metaOf(metadata).at}-${i}`, segment.code)"
                    />
                  </template>
                </div>
                <ChatMarkdown v-else :text="textOf(parts)" data-testid="chat-message" />
              </template>
            </UChatMessages>
          </div>
          <!-- Sticky at the bottom of the viewport, not just the last
               thing on a page that might now scroll — reachable without
               scrolling past the whole message history (developer
               feedback, 2026-09-27). -->
          <div class="bg-elevated sticky bottom-0 flex flex-col gap-1.5">
            <UChatPrompt
              v-model="chatInput"
              :autofocus="false"
              :maxrows="5"
              variant="subtle"
              placeholder="Message — Markdown works; put code in `backticks`"
              data-testid="chat-input"
              @submit="sendChat"
            >
              <UChatPromptSubmit status="ready" color="neutral" size="xs" data-testid="chat-send" />
              <template #footer>
                <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    trailing-icon="i-lucide-chevron-down"
                    data-testid="model-selector"
                    @click="modelNotImplemented"
                  >
                    @jah default
                  </UButton>
                  <USwitch
                    v-model="toJah"
                    size="xs"
                    label="to @jah"
                    :disabled="jahAvailability !== 'available'"
                    data-testid="jah-switch"
                  />
                  <!-- Confirmed UX (2026-09-29): a plain label, not a
                       richer preview. Read fresh from the editor at send
                       time regardless — this only tells the asker one
                       is attached. -->
                  <UBadge
                    v-if="hasSelection"
                    size="xs"
                    color="neutral"
                    variant="subtle"
                    icon="i-lucide-text-cursor-input"
                    data-testid="selection-attached"
                  >
                    Selection attached
                  </UBadge>
                </div>
              </template>
            </UChatPrompt>
            <p v-if="jahHint" class="text-muted text-xs" data-testid="jah-switch-hint">
              {{ jahHint }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-show="activeTab === 'ascii'"
        class="bg-elevated relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-md p-3"
        data-testid="ascii-panel"
      >
        <h2 class="text-muted text-xs font-medium uppercase tracking-wide">
          ASCII art
        </h2>

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
      </div>
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
