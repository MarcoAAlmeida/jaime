## Why

JAM is one collaboration model — each person owns a track, patterns are
whole-string-replaced, last-write-wins per track. Phase 6 of the
tools-hub roadmap adds the other model: **one shared document that
several people edit at the same time**, character by character, the way
a pair-programming session or a Google Doc works. That's the
Composition Room (Journey 3, stories 12–19).

Two things fall out of doing this now:

- **The audio engine gets lifted to full strudel.cc parity.** JAM
  today runs a deliberately-curated subset (built-in synths + the
  `dirt-samples` bank, one pattern per track). A Composition Room is a
  whole shared piece of music, so it needs the real thing — the full
  default sample map, `$:` layered patterns, `setcps`, the transpiler
  sugar, and pattern-driven visuals. Rather than maintain two engine
  configs, this lifts the **one** engine both tools share, so JAM stops
  being narrowed too. (`@codemirror/collab` was the roadmap's noted
  mechanism; this uses **Yjs / `y-codemirror.next`** instead — see
  design.md.)

- **The chat panel becomes real.** The roadmap always had a chat panel
  beside the editor whose *eventual* job is an AI assistant (Phase 7).
  This ships it as a working, ephemeral, human-to-human room chat now;
  Phase 7 adds the AI as another participant in it.

This is a large change. The engine-parity work (groups 1–2 of tasks) is
independently useful and could be pulled into its own change if you'd
rather ship it to JAM first — flag it at review.

## What Changes

- **New Composition Room tool** at `/app/composition` — create a room,
  join by shareable link, pick **editor** or **viewer** on join
  (self-declared, one link, no server-enforced ACL — mirrors JAM's
  trust model).
- **One shared CodeMirror document** per room, edited collaboratively:
  simultaneous edits merge (not last-write-wins), backed by a Yjs
  document whose authority + persistence live in the room's Durable
  Object. The document survives a Worker restart; presence and chat do
  not.
- **Live presence + cursors** — who's in the room, their role, and
  each editor's caret/selection rendered in their colour.
- **Shared synced playback** — evaluating the document broadcasts to
  the room; every client (editors and viewers) runs the current
  document locked to the room's shared transport clock, so everyone
  hears the same thing in time. Reuses JAM's clock.
- **Working room chat** — an ephemeral text panel beside the editor,
  cleared on restart / when everyone leaves.
- **Audio engine → strudel.cc parity** (shared by JAM and the
  Composition Room):
  - the full strudel.cc default sample map, not just `dirt-samples`;
  - `$:` / labelled multi-pattern documents (`$drums: …`, `$bass: …`)
    with per-label mute/solo;
  - `setcps` / `setcpm` honoured from the document;
  - pattern-driven visuals — `.punchcard()`, `.pianoroll()`,
    `._scope()`, `._spectrum()`, `.markcss()` — plus the mini-notation
    **event highlight** in the editor gutter/text;
  - the `@strudel/transpiler` sugar strudel.cc assumes.
- **Out of scope, noted:** Hydra / WebGL video synthesis (its own
  system and language — a later change if wanted), MIDI/OSC I/O,
  loading arbitrary user sample banks via `samples('github:…')` from
  inside a room, and the AI in the chat panel (Phase 7).

## Capabilities

### New Capabilities

- `composition-room`: the collaborative-document tool — room
  lifecycle (create / join / shareable link), editor vs viewer roles,
  one shared document that merges concurrent edits and persists across
  restarts, live presence + cursors, document evaluation broadcast to
  the room with transport-synced playback for everyone, and an
  ephemeral room chat.

### Modified Capabilities

- `frontend-editor`: the Strudel engine and editor gain full
  strudel.cc parity — an expanded default sample set, labelled
  multi-pattern (`$:`) documents, `setcps` from the document,
  transpiler sugar, mini-notation event highlighting, and
  pattern-driven visuals. Existing behaviour (per-track editing, "every
  curated pattern plays", invalid-pattern handling) is unchanged; the
  "curated subset" framing is dropped.
- `hub-mock-screens`: remove the "Composition Room Mock" requirement —
  the room is real now.

## Impact

- **New**: `y`, `y-codemirror.next`, and a Yjs provider (client
  transport) as dependencies; a Yjs document store + sync handler in
  the room Durable Object keyed by composition-room id;
  `app/pages/app/composition/…` (real room, replacing the mock);
  `shared/` protocol types for the composition-room WebSocket messages
  (Yjs update frames, presence, chat, eval); a shared cursor /
  remote-selection extension for CodeMirror.
- **Changed**: `app/lib/audioEngine.ts` (sample map, `$:` handling,
  visuals, transpiler), `app/components/TrackEditor.vue` or a shared
  editor factory (event highlight, visuals mount points),
  `server/routes/room.ts` (or a sibling handler) for the new protocol,
  `content/docs/strudel/*` (drop the "subset JAM supports" framing
  now that parity is real), the Composition Room mock is deleted.
- **Bundle size**: the full sample map is lazy-loaded like
  `dirt-samples` is today; the visuals draw calls are Strudel's own,
  no new render lib. Yjs + `y-codemirror.next` add ~30–40 KB gzipped
  to the editor route.
- **Risk surface**: the engine upgrade touches JAM's playback path —
  the `pattern-playback` e2e ("every curated pattern plays") is the
  regression guard and must stay green.
- No D1 / schema change. No API-route change to `/api/patterns*` or
  auth.
