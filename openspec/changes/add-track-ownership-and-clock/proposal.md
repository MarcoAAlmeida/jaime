## Why

Phase 2 proved the relay with one shared, unowned pattern. Per
`04-roadmap.md`, the next source of complexity is track ownership
(so multiple people can jam without stepping on each other's edits) and
the shared transport clock (so their patterns start in phase instead of
drifting audibly out of sync). This is the last piece before rooms
become multi-instance (Phase 4) and state survives reconnects (Phase 5).

## What Changes

- A fixed track roster (`drums`, `bass`, `lead`, `pad`) replaces Phase
  2's single shared pattern — each track has its own code and, now, an
  owner
- `claim_track` / `release_track` messages let a client take or give up
  a track; only the current owner may send pattern updates for it
- The Durable Object rejects a `pattern_update` from a non-owner instead
  of relaying it (**BREAKING** for Phase 2's "anyone can edit the shared
  pattern" behavior — that behavior is intentionally retired here, not
  preserved)
- A shared transport clock: each client estimates its round-trip offset
  from the Durable Object on connect, and schedules playback start
  against the DO's `cycleStartTimestamp` corrected by that offset, so
  clients start the same cycle in phase without any audio crossing the
  wire
- Tempo changes pick a new `cycleStartTimestamp` at the next bar
  boundary and broadcast it, so clients re-lock at a musical moment
  instead of snapping instantly
- The editor UI gains real controls for the first time (claim/release
  buttons, an owner indicator per track) — Phases 1 and 2 deliberately
  stayed keybinding-only; claiming a track is a discrete, visible-state
  action that doesn't fit a keyboard shortcut
- `audioEngine.ts` moves from one scheduler for one shared pattern to
  one scheduler per track, all sharing the existing `AudioContext` — the
  shape `03-architecture-frontend.md` originally described, which Phase
  1/2 didn't need yet

## Capabilities

### New Capabilities
- `track-ownership`: claiming/releasing tracks, ownership enforcement,
  and which client owns which track being visible in the UI
- `transport-clock`: round-trip offset estimation, synchronized playback
  start, and tempo-change re-locking

### Modified Capabilities
- `realtime-room`: the Pattern Relay requirement changes from "relay any
  connected client's update" to "relay only the owning client's update,
  reject others" — a real behavior change, not just an implementation
  detail
- `frontend-editor`: the Pattern Editing requirement changes from "one
  globally-editable editor" to "one editor per track, editable only by
  that track's current owner"

## Impact

- New files: track-ownership UI (claim/release controls, owner
  indicator), transport-clock client logic (offset estimation,
  corrected scheduling)
- Modified files: `server/routes/room.ts` (multi-track state, ownership
  checks, clock messages), `app/plugins/websocket.client.ts` (new
  message types), `app/lib/audioEngine.ts` (one scheduler per track),
  `useJamSession.ts` (shape change: single `code` → per-track state +
  clock state)
- Test additions per `02-architecture-backend.md` /
  `04-roadmap.md`: Playwright with multiple browser contexts (claim
  rejection, update propagation), a clock-drift assertion (<20ms after
  correction), and CDP network throttling to validate the offset
  correction under real jitter, not just near-zero localhost latency
- No persistence yet (Phase 5) — track ownership and clock state are
  in-memory only, same accepted limitation as Phase 2's pattern code
