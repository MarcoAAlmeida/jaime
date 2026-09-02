## Why

JAM is one collaboration model — each person owns a track, patterns are
whole-string-replaced, last-write-wins per track. Phase 6 of the
tools-hub roadmap adds the other model: **one shared document that
several people edit at the same time**, character by character, the way
a pair-programming session or a Google Doc works. That's the
Composition Room (Journey 3, stories 12–19).

The chat panel becomes real here too. The roadmap always had a chat
panel beside the editor whose *eventual* job is an AI assistant
(Phase 7); this ships it as a working, ephemeral, human-to-human room
chat now, and Phase 7 adds the AI as another participant in it.

**Depends on `add-strudel-parity`** — the shared engine upgrade (full
sample map, `$:`, `setcps`, event highlight, pattern-driven visuals)
was split into its own change so the invasive engine work lands and
bakes in JAM before the collaborative-editing work builds on it. This
change assumes that engine exists.

## What Changes

- **New Composition Room tool** at `/app/composition` — create a room,
  join by shareable link, pick **editor** or **viewer** on join
  (self-declared, one link, no server-enforced ACL — mirrors JAM's
  trust model).
- **One shared CodeMirror document** per room, edited collaboratively:
  simultaneous edits merge (not last-write-wins), backed by a Yjs
  document whose authority + persistence live in the room's Durable
  Object. The document survives a Worker restart; presence and chat do
  not. (`@codemirror/collab` was the roadmap's noted mechanism; this
  uses **Yjs / `y-codemirror.next`** instead — see design.md.)
- **Live presence + cursors** — who's in the room, their role, and
  each editor's caret/selection rendered in their colour.
- **Shared synced playback** — evaluating the document broadcasts to
  the room; every client (editors and viewers) runs the current
  document locked to the room's shared transport clock, so everyone
  hears the same thing in time. Reuses JAM's clock.
- **Working room chat** — an ephemeral text panel beside the editor,
  cleared on restart / when everyone leaves.
- **Out of scope, noted:** the AI in the chat panel (Phase 7); Hydra,
  MIDI/OSC, and room sample-bank loading (never in scope, see
  `add-strudel-parity`).

## Capabilities

### New Capabilities

- `composition-room`: the collaborative-document tool — room
  lifecycle (create / join / shareable link), editor vs viewer roles,
  one shared document that merges concurrent edits and persists across
  restarts, live presence + cursors, document evaluation broadcast to
  the room with transport-synced playback for everyone, and an
  ephemeral room chat.

### Modified Capabilities

- `hub-mock-screens`: remove the "Composition Room Mock" requirement —
  the room is real now. This retires the capability (its last
  requirement).

## Impact

- **New**: `yjs`, `y-codemirror.next`, `y-protocols` (added early with
  `add-strudel-parity`, commit `d9a5510`) + a thin custom Yjs provider
  (`app/lib/compositionProvider.ts`); a Yjs document store + sync
  handler in the room Durable Object keyed by composition-room id;
  `app/pages/app/composition/…` (real room, replacing the mock);
  `shared/compositionProtocol.ts` (Yjs update frames, presence, chat,
  eval).
- **Changed**: `server/routes/room.ts` (or a sibling handler) for the
  new protocol; the shared editor factory from `add-strudel-parity` is
  reused for the room's editor with `yCollab` appended;
  `content/docs/strudel/*` only if a Composition-Room reference is
  worth adding; the Composition Room mock is deleted.
- **Bundle size**: Yjs + `y-codemirror.next` + `y-protocols` add
  ~40 KB gzipped to the editor route (lazy-loaded).
- **Risk surface**: additive — a new route and a new DO branch.
  Disabling the route leaves JAM untouched. The engine risk lives in
  `add-strudel-parity`.
- No D1 / schema change. No API-route change to `/api/patterns*` or
  auth.
