## Context

See `proposal.md` — Why. Current state:

- **One Durable Object for the whole Worker** (Nitro `cloudflare-durable`
  preset). "Rooms" are entries in an in-memory `Map` keyed by room id +
  crossws topic scoping, not separate DO instances
  (`server/routes/room.ts`). Persistence: `getDurableStorage()` k/v,
  presence deliberately excluded.
- **JAM's realtime protocol** (`shared/roomProtocol.ts`) is JSON over
  crossws (`peer.send(JSON.stringify(...))`, `message.json<T>()`),
  single-owner per track, whole-string `pattern_update`.
- **Transport clock** (`app/lib/transportClock.ts`): `waitForSynchronizedStart`
  aligns a repl's start to `nextCycleBoundary(cycleStartTimestamp, bpm)`
  using the estimated DO-clock offset. Room-type-agnostic.
- **Audio engine** (`app/lib/audioEngine.ts`): hand-wired — one
  `webaudioRepl` per track, `evalScope` of core/mini/tonal,
  `registerSynthSounds()`, a one-time `samples('github:tidalcycles/dirt-samples')`.
  No `$:` support, no visuals, no mini-notation highlight, no widgets.
- **Editor** (`app/components/TrackEditor.vue`): calls
  `@strudel/codemirror`'s `initEditor()` (a sealed `EditorView`), then
  `StateEffect.appendConfig.of(...)` for the editable compartment.
  External code changes are applied by replacing the whole doc.
- **`@strudel/codemirror` ships `StrudelMirror`** — the strudel.cc
  editor class: `initEditor()` + `repl()` + a `Drawer` + mini-location
  highlight wiring + slider/widget updates + a caller-supplied
  `prebake()` + `drawContext`. `@strudel/draw` (`pianoroll`,
  `getPunchcardPainter`, `getDrawContext`) is installed but unused.
- **`@tiptap/extension-collaboration` (Yjs-based) is already a dep** from
  earlier exploration.
- The Composition Room is a mock (`app/pages/app/composition-room.vue`).

## Goals / Non-Goals

**Goals:**

- One shared document per Composition Room, merged edits, backed by Yjs,
  with the authority + snapshot persistence in the existing DO.
- Editor/viewer roles, live cursors, presence — self-declared, JAM's
  trust model.
- Room-synced playback reusing the transport clock; viewers hear it.
- Ephemeral room chat.
- **One** audio+editor engine at strudel.cc parity, used by both JAM
  and the Composition Room — JAM stops being the narrowed one.

**Non-Goals:**

- Hydra / WebGL video synthesis, MIDI/OSC, `samples('github:…')` from
  inside a room, the chat AI (all later / Phase 7).
- Per-keystroke auto-evaluation — evaluation stays explicit
  (Ctrl-Enter), like strudel.cc.
- A separate per-room Durable Object (the preset doesn't do that; not
  worth fighting it here).
- Server-enforced access control on roles beyond dropping writes from a
  self-declared viewer.

## Decisions

### 1. Yjs + `y-codemirror.next`, not `@codemirror/collab`

The roadmap noted `@codemirror/collab` (OT + central authority). Using
Yjs (CRDT) instead, per direction:

- **`y-codemirror.next` gives remote cursors and collaborative undo out
  of the box** (`yCollab(ytext, awareness, {undoManager})` +
  `yRemoteSelections`), including the fiddly part — remapping a remote
  caret through local edits so it doesn't drift. With `@codemirror/collab`
  that's ~100 hand-written lines.
- **Shared infra with the existing Yjs dep** — if a rich-text surface
  ever appears (tiptap is already installed), it's the same `Y.Doc`
  layer.
- **The server gets simpler, not harder** — it applies and relays
  opaque binary updates and never has to order anything or run a
  reject-and-retry loop.
- Accepted costs: CRDT metadata per character (documents here are
  small — a page of Strudel), deletion tombstones (Yjs GCs them), and
  no true offline-merge (a live session always has the authority
  online). All fine for this use.

Alternative kept in mind: `@codemirror/collab` is lighter on the wire
and needs no CRDT lib. Rejected because the cursor/undo work it pushes
onto us outweighs its wire savings for a feature whose whole point is
multi-editor UX.

### 2. Yjs authority + snapshot persistence in the single DO

Mirror JAM's room model: `compositions: Map<roomId, { ydoc: Y.Doc,
bpm, cycleStartTimestamp, presence, chat }>`. The DO, per composition
room:

- applies each incoming client update (`Y.applyUpdate(ydoc, update)`)
  and relays it to the room's other peers (crossws topic per room id);
- **snapshots** `Y.encodeStateAsUpdate(ydoc)` to `getDurableStorage()`
  under `composition:<id>`, debounced ~2 s after the last change;
- on first access of a room, seeds `ydoc` from the stored snapshot if
  present, else an empty/starter document;
- evicts an idle room's `ydoc` from memory after a quiet period (last
  snapshot already written), same lifecycle shape as JAM rooms.

The DO does **not** need to understand the document — apply + relay +
snapshot. Applying server-side (rather than storing a raw update log)
keeps a canonical merged state ready for late joiners and keeps storage
bounded to one snapshot.

**Yjs updates are binary; crossws today sends JSON.** Frame them as
`{ t: 'y-update' | 'y-sync' | 'y-awareness', room, payload }` with
`payload` base64 (Uint8Array ⇄ base64). If crossws is confirmed to pass
`ArrayBuffer`/`Uint8Array` through untouched, send raw binary frames
with a 1-byte type tag instead — decide in the group 3 spike.

### 3. A thin custom Yjs provider over the existing WebSocket

No `y-websocket` server. The client provider:

- on `ydoc.on('update', u)` → send a `y-update` frame;
- on incoming `y-update` → `Y.applyUpdate(ydoc, u, provider)`;
- **initial sync**: on connect, exchange state vectors — client sends
  `y-sync` step-1 (its state vector), server replies step-2
  (`Y.encodeStateAsUpdate(ydoc, clientSV)`), and vice-versa. Use
  `y-protocols/sync` + `y-protocols/awareness` for the handshake rather
  than hand-rolling.
- awareness (`y-protocols/awareness`) carries `{ user: { name, color },
  role }` and cursor state; it is **ephemeral** — never snapshotted.

### 4. Roles = an `editable` compartment + a server-side write drop

- **Client**: `EditorView.editable.of(isEditor)` in a `Compartment`
  (the pattern `TrackEditor.vue` already uses); `yCollab` stays
  attached for viewers so they receive edits, they just can't originate
  them. Role lives in awareness; switching role reconfigures the
  compartment live, no rejoin.
- **Server**: the join frame declares the role; the DO drops `y-update`
  frames from a connection currently marked `viewer`. Self-declared,
  lightly enforced — same posture as JAM ("anyone can claim any open
  track", but the server still validates the message).

### 5. Synced playback reuses the transport clock

A Composition Room carries `bpm` + `cycleStartTimestamp` in its
persisted state, exactly like a JAM room, and clients use the existing
`waitForSynchronizedStart` as the repl's `beforeStart`.

- **Evaluate** (Ctrl-Enter) broadcasts `{ t: 'eval', room, atCycle }` —
  *not* the code; every client already has the document via Yjs. Each
  client (editors **and** viewers) reads its local Y.Text, evaluates it
  on its own repl, and starts aligned to the next shared cycle
  boundary.
- **Stop** broadcasts similarly.
- Between evaluations the audio keeps playing the last-evaluated
  version; typing does not auto-evaluate.
- **Late joiner**: the join response includes `{ playing, atCycle }`;
  if playing, the client evaluates the current document and locks to
  the clock without anyone re-triggering.
- Errors are local — each client's editor shows its own eval error; a
  document syntax error therefore shows for everyone.

### 6. One engine at parity, built on `StrudelMirror` + a jaime `prebake()`

Reaching strudel.cc parity by extending the bespoke engine means
re-implementing sample-map loading, `$:` handling, the `Drawer`,
mini-location highlighting, and widget/slider updates — all of which
`@strudel/codemirror`'s `StrudelMirror` already does. So:

- **Composition Room**: one `StrudelMirror` for the shared editor.
  `yCollab(...)` is appended to its editor via
  `StateEffect.appendConfig` (same mechanism as the editable
  compartment). `drawContext` = a `<canvas>` jaime mounts near the
  editor; `beforeStart` = `waitForSynchronizedStart`.
- **JAM**: one `StrudelMirror` per track, `solo: false` (tracks
  coexist), sharing one lazy `prebake()` promise and the singleton
  `AudioContext`. Per-track `beforeStart` stays
  `waitForSynchronizedStart`. This gets JAM highlight + widgets + `$:`
  + visuals "for free" and keeps a single engine path.
- **`prebake()`** is jaime's own function that registers the full
  strudel.cc default sample map (`samples(url)` for Dirt-Samples — kept
  — plus VCSL, tidal-drum-machines, EmuSP12, mridangam, etc., the set
  strudel.cc's REPL bakes). Lazy-loaded exactly like `dirt-samples` is
  today; a synth-only pattern still plays without waiting.
- **Visuals**: `@strudel/draw` (already installed) provides the
  painters; `StrudelMirror`'s `onDraw`/`Drawer` already drive them.
  `scope`/`spectrum` come from `@strudel/webaudio`. jaime mounts the
  draw canvas; nothing new to render with.

**Main integration risk (group 1 spike)**: `StrudelMirror` assumes one
instance per page in places — it dispatches a `start-repl` custom event
for solo, and `initTheme()` forces `document.documentElement.classList.add('dark')`
(`TrackEditor.vue` already works around the theme hijack). N instances
for JAM must set `solo: false` and share the theme workaround. If N
`StrudelMirror` proves too heavy or too entangled, fall back to keeping
JAM's per-track `webaudioRepl` and bolting on the parity pieces
individually (prebake, `@strudel/draw` painters, `@strudel/codemirror`
highlight) — the specs don't change either way.

### 7. Docs

`content/docs/strudel/in-jam.md` becomes "Strudel in jaime" — drop the
"curated subset / leaves out" framing now that both tools run the full
engine; keep an honest short list of the real remaining exceptions
(Hydra, MIDI, room-loaded sample banks).

## Risks / Trade-offs

- **Engine upgrade regresses JAM playback** → do groups 1–2 first and
  gate on the `pattern-playback` e2e ("every curated pattern plays")
  and `multi-client` e2e before touching the room.
- **N `StrudelMirror` in JAM** — solo events, theme hijack, bundle
  weight → `solo: false`, the existing theme workaround, lazy-load;
  fallback in decision 6.
- **Yjs + `y-codemirror.next` + `y-protocols` bundle** (~40 KB gzip) →
  lazy-loaded with the editor route, acceptable.
- **DO memory / CPU** — a `Y.Doc` per active composition room, applying
  updates server-side → documents are small; evict idle rooms like JAM.
- **Binary-over-crossws** unknown → base64 fallback in decision 2;
  confirm in the spike.
- **Awareness never persisted** — a late joiner sees cursors only for
  people currently connected, which is the intended behaviour.

## Migration Plan

1. **Engine parity (groups 1–2):** add `@strudel/draw` use + `y`/
   `y-codemirror.next`/`y-protocols` deps; write `prebake()`; move
   `audioEngine.ts` / the editor to the `StrudelMirror`-based path for
   JAM; get `pattern-playback` + `multi-client` + `nuxt typecheck`
   green. Shippable on its own if desired.
2. **Composition room (groups 3–6):** DO Yjs handler + snapshot; the
   client provider; the real `/app/composition` room (shared
   `StrudelMirror` + `yCollab`); roles + editable compartment; cursors
   via awareness; synced eval/stop; room chat.
3. **Cutover:** replace the mock route, delete
   `composition-room.vue` mock, update `hub-mock-screens` +
   `content/docs/strudel`.
4. Rollback: the engine change is the risky part; it reverts as a unit.
   The composition-room code is additive (new route + new DO branch) —
   disabling the route leaves JAM untouched.

## Open Questions

- N `StrudelMirror` vs. bespoke-repl-plus-parity-pieces for JAM —
  resolved by the group 1 spike; affects task detail, not the specs.
- The exact sample-bank URL set to mirror from strudel.cc — a content
  detail, settled while writing `prebake()`.
