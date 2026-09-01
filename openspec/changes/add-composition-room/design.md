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
- **The shared engine + editor factory** comes from `add-strudel-parity`
  (a prerequisite): one `StrudelMirror`-based (or parity-augmented)
  editor at strudel.cc feature level — full sample map, `$:`, document
  `setcps`, mini-notation highlight, `@strudel/draw` visuals — taking a
  root element + a draw canvas + `beforeStart: waitForSynchronizedStart`.
  This change reuses that factory and appends a `yCollab` extension.
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
- Reuse `add-strudel-parity`'s editor factory unchanged — the room adds
  collaboration on top, it does not fork the engine.

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

**Yjs updates are binary; crossws today sends JSON.** Decided (was the
group 1 spike): every binary field is **base64 inside a JSON frame**
(`{ t: 'y-update', u: '<b64>' }` etc., see
`shared/compositionProtocol.ts`). Raw-binary passthrough over crossws +
the Cloudflare hibernation serialization was not worth de-risking for a
payload that is tens–hundreds of bytes per keystroke-batch; base64's
~33% overhead is irrelevant here and this keeps one code path with
JAM's JSON handler.

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
persisted state, exactly like a JAM room, and clients align playback to
the next cycle boundary the same way JAM does.

`transportClock.ts`'s `waitForSynchronizedStart` was JAM-coupled — it
read `useJamSession()` and the JAM WS plugin's `getOffset()`. Extract a
generic `waitForCycleBoundary(cycleStartTimestamp, bpm, offset)` (the
existing function becomes a thin JAM-bound wrapper), and give
`createStrudelEditor` a `beforeStart?` option (default: the JAM
wrapper). The Composition Room passes a `beforeStart` closure over its
own clock state + its own ping/pong offset (the DO clock is the same
single instance for both room types, but a client that went straight to
a composition room never ran JAM's offset estimate).

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

### 6. The room's editor is `add-strudel-parity`'s factory + `yCollab`

The Composition Room builds one editor from `add-strudel-parity`'s
shared factory (a `StrudelMirror`-based or parity-augmented editor at
strudel.cc feature level) and appends `yCollab(ytext, awareness,
{ undoManager })` via `StateEffect.appendConfig` — the same mechanism
`TrackEditor.vue` uses for the editable compartment. `drawContext` is a
`<canvas>` the room mounts near the editor; `beforeStart` is
`waitForSynchronizedStart`.

No engine work happens here — that all lives in `add-strudel-parity`.
If that change lands the bespoke-repl fallback rather than
`StrudelMirror`, this design is unaffected: the factory contract (root
+ canvas + `beforeStart`, evaluate/stop/error surface) is the same and
`yCollab` still appends to whatever `EditorView` it produces.

### 7. Docs

Any Composition-Room mention in `content/docs/strudel/*` is added if
useful; the "curated subset" rewrite belongs to `add-strudel-parity`.

## Risks / Trade-offs

- **Yjs + `y-codemirror.next` + `y-protocols` bundle** (~40 KB gzip) →
  lazy-loaded with the editor route, acceptable.
- **DO memory / CPU** — a `Y.Doc` per active composition room, applying
  updates server-side → documents are small; evict idle rooms like JAM.
- **Binary-over-crossws** unknown → base64 fallback in decision 2;
  confirm in the spike.
- **Awareness never persisted** — a late joiner sees cursors only for
  people currently connected, which is the intended behaviour.

## Migration Plan

1. **Prerequisite:** `add-strudel-parity` is applied and archived — the
   shared editor factory exists and JAM is green on it.
2. **DO + protocol (group 1):** `shared/compositionProtocol.ts`; the
   Yjs branch in the room handler (`Y.applyUpdate` + relay, viewer-write
   drop, debounced snapshot, `y-sync` handshake); pool-workers tests.
3. **Client (groups 2–4):** the custom provider; the real
   `/app/composition` room (factory + `yCollab`); roles + editable
   compartment; cursors via awareness; synced eval/stop; room chat;
   `e2e/composition.spec.ts`.
4. **Cutover (group 5):** route the real room, delete the mock, retire
   `hub-mock-screens`.
5. Rollback: additive — a new route and a new DO branch. Disabling the
   route leaves JAM and `add-strudel-parity` untouched.

## Open Questions

- Raw-binary vs. base64 frames over crossws — confirmed in the group 1
  spike (`server/routes/room.ts` sends JSON today); a base64 wrapper is
  the safe default.
