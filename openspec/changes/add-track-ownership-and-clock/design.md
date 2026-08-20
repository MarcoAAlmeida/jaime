## Context

See proposal.md - Why. Builds on Phase 2's relay (`server/routes/room.ts`,
`app/plugins/websocket.client.ts`) and Phase 1's `audioEngine.ts`. Per
`02-architecture-backend.md`, scoped to ownership + clock — persistence,
multi-room, and presence stay out of scope for their own later phases.

## Goals / Non-Goals

**Goals:**
- Multiple people can each own a track and edit it without collision
- Playback starts in phase across clients without audio crossing the
  wire, per `02-architecture-backend.md`'s transport clock design

**Non-Goals:**
- Multiple/dynamic rooms (Phase 4)
- Presence list, display names (Phase 4/6)
- Persistence across cold starts (Phase 5) — ownership and clock state
  are in-memory only, same accepted limitation as Phase 2
- Sample-accurate sync — `setTimeout`-based scheduling has real jitter;
  this phase targets "close enough to not sound wrong," not
  professional-grade sync

## Decisions

### Decision: Fixed track roster: `drums`, `bass`, `lead`, `pad`
Not derived from any existing doc — `01-project-overview.md` says
"each person owns one instrument/track" but never names them. Picked a
plausible small jam-session roster as a working assumption, confirmed
with the user rather than silently assumed. Defined once as a shared
constant so client and Durable Object agree on valid track names.

### Decision: Per-connection client IDs
Phase 2's relay never needed to know *who* sent an update. Ownership
requires it — the Durable Object assigns each connection a random ID on
open (crossws's `peer.id` already provides this) and tracks it as the
track's `owner` value directly; no separate identity system needed yet
(that's Phase 6).

### Decision: Ownership enforced server-side, not just in the UI
The Durable Object is the sole authority: `claim_track` only succeeds if
the track is unowned; `pattern_update` for a track is silently dropped
(not relayed) if the sender isn't that track's current owner, regardless
of what the client's own UI shows. The UI disabling a non-owned editor
is a courtesy, not the enforcement boundary — a client bypassing its own
UI must not be able to bypass ownership.

### Decision: One `webaudioRepl()` per track, sharing one `AudioContext`
Matches `03-architecture-frontend.md`'s original module breakdown ("One
Strudel scheduler per track, all sharing a single AudioContext"), which
Phase 1/2 didn't need since there was only one shared pattern.
`audioEngine.ts` changes from a single module-level `repl` to a registry
keyed by track name; `getAudioContext()` already returns the same
singleton regardless of how many repl instances call it, so no explicit
sharing logic is needed beyond calling it normally per track.

### Decision: Synchronized start via Strudel's `beforeStart` hook
Confirmed by reading `@strudel/core/cyclist.mjs`: `Cyclist.start()`
takes no time argument — it always starts immediately relative to
`getTime()`. It does accept a `beforeStart` async hook, awaited before
the clock actually starts. Each track's `webaudioRepl({ beforeStart })`
uses this to delay the actual start until the client's locally-corrected
target time (`cycleStartTimestamp + estimatedOffset`) arrives, via a
promise that resolves at that computed time. This is a real, verified
mechanism, not an assumption about Strudel's API.

### Decision: Round-trip offset estimation via echo
On connect, the client sends `{ type: 'clock_ping', clientSendTime }`;
the Durable Object echoes it back immediately as
`{ type: 'clock_pong', clientSendTime, serverTime }`. The client computes
its offset as `serverTime - (clientSendTime + roundTrip / 2)` — the
standard half-round-trip estimate `02-architecture-backend.md` describes,
not raw one-way latency (which isn't directly measurable without
synchronized clocks in the first place).

### Decision: Tempo changes re-lock at the next bar boundary
The Durable Object computes the next bar boundary from the current
`cycleStartTimestamp` and `bpm`, sets the new `cycleStartTimestamp` to
that boundary, and broadcasts it alongside the new `bpm`. Clients
already playing continue their current bar unmodified and only apply
the new tempo once local playback reaches that boundary — avoiding an
audible tempo snap mid-bar.

### Decision: A closed connection releases its owned tracks
Not in the original plan — added after implementation revealed it was
necessary, not just nice-to-have. Without it, a track claimed by a
connection that later disconnects (closed tab, crashed browser) stays
permanently locked for the rest of the room's in-memory lifetime, since
nothing else could ever release it. Also directly fixes real test
flakiness: with only 4 tracks and no auto-release, unit tests that claim
a track without explicitly releasing it left that track locked for every
later test in the same run, since Durable Object state isn't reset
between test cases within a file. The `close` handler releases any
tracks the disconnecting peer owned, broadcasting `ownership_update` for
each.

### Decision: Starter patterns per track, and Play/Stop buttons
Added after the user tried the deployed app and found it silent (no
starter content) and unplayable on mobile (Ctrl-Enter needs a keyboard
that doesn't exist on a touchscreen). Both fit within this change's
existing scope rather than warranting a separate one:
- `shared/tracks.ts` gains `DEFAULT_CODE`, a starter pattern per track
  using only the registered synth waveforms (no sample bank yet, so
  even "drums" is a synth pattern, not a literal drum hit) — used by
  both the server's initial room state and the client's pre-connect
  placeholder, so there's no flash of empty content before `room_state`
  arrives.
- `jam.vue` gains Play/Stop buttons next to Claim/Release, visible only
  when the local client owns the track (same visibility rule already
  used for Release) — a touch-friendly equivalent to the existing
  Ctrl-Enter/Ctrl-. keybindings, not a replacement for them.

### Decision: Play/Stop is shared, broadcast room state — not a local action
The user tried the deployed app across two devices and found it silent
on every client except the one that clicked Play: `evaluate()`/`stop()`
were called directly from the button handlers, entirely local, which
contradicts `01-project-overview.md`'s own premise that "each browser
evaluates its own audio locally... hears everyone's tracks mixed
together." Discussed three alternatives (global room-wide play/stop,
per-track broadcast `isPlaying` with local mute, auto-evaluate on every
edit) before implementing, per the user's explicit request not to jump
straight to a fix. Chose per-track broadcast:
- `TrackState` gains `isPlaying: boolean`; the Durable Object adds
  `play_track`/`stop_track` (owner-gated, like `pattern_update`) and
  broadcasts `playback_update` to *every* connection including the
  sender (`broadcastToAll`, unlike `pattern_update`'s
  `broadcastToOthers` — every client, not just other clients, needs to
  react to isPlaying changes by actually starting/stopping local audio).
- `releaseAndStop()` (renamed from the prior release-only helper) also
  clears `isPlaying` and broadcasts that, so `release_track` and the
  owner-disconnect `close()` handler can never leave a track marked
  playing with no owner able to ever stop it.
- Each client's own `jam.vue` watches `tracks[track].isPlaying` and
  calls local `evaluate()`/`stop()` in response — the only thing
  Play/Stop ever does is tell the room "this track's state changed";
  actually making sound is a client-local reaction to that shared state,
  same pattern as `pattern_update`.

### Decision: `playRequestSeq` — a monotonic counter alongside `isPlaying`
A Vue `watch()` on a primitive only fires on an actual value change.
Re-pressing Play on an already-playing track (e.g. after fixing a typo
in the code, without stopping first) is a `true → true` "transition" —
a no-op for `watch()`, so the edited code would never actually get
re-evaluated. `useJamSession` adds `playRequestSeq: Record<TrackName,
number>`, bumped in `websocket.client.ts` on every `playback_update`
with `isPlaying: true` (whether or not it was already true).
`jam.vue`'s watch list includes it as a third source specifically to
force re-evaluation on repeat play requests; `stop()` itself is
idempotent so `isPlaying` alone is sufficient on the stop side.

### Decision: Mute is local-only, never sent to the server
The user asked for a per-track mute switch
(`https://ui.nuxt.com/docs/components/switch`) as part of the same fix.
It's a personal listening preference, not room state — muting a track
for yourself must never affect whether anyone else hears it, and must
never appear in `TrackState` or any protocol message. `jam.vue` keeps
`muted: Record<TrackName, boolean>` as local component state; the
per-track watcher combines it with `isPlaying`/`playRequestSeq` to
decide whether to actually call `evaluate()` for a track that's playing
room-wide, and calls `stop()` whenever this client shouldn't currently
be making sound for it (either the room says the track is stopped, or
it's muted locally) — so unmuting a still-playing track resumes audio
immediately using the reactive state already held, without re-sending
anything to the server.

### Decision: Fixed the synchronized-start delay never actually delaying
Found while confirming the mute/broadcast design was feasible, not
reported by the user: `waitForSynchronizedStart()` used
`cycleStartTimestamp` directly as the target time for `beforeStart`.
`cycleStartTimestamp` is a fixed reference phase for the tempo grid
(`cycleStartTimestamp + n * cycleDuration` for any integer `n`), not
literally "the next time to start" — by the time anyone actually clicks
Play, it's almost always already in the past, so the computed delay was
always ~0 and starts were never actually phase-locked across clients.
Added `shared/transportMath.ts` (`nextCycleBoundary()`) as the single
place both the server (`set_tempo`'s re-lock logic, which had its own
inline copy of the same math) and the client
(`waitForSynchronizedStart()`) compute the next real bar boundary from
that reference phase — fixing the bug and removing a duplicated
implementation at once.

## Risks / Trade-offs

- [Risk] `setTimeout`-based `beforeStart` delay has real jitter (browser
  timer granularity, tab throttling in background tabs) — not
  sample-accurate. → Mitigation: accepted per Goals/Non-Goals above;
  `02-architecture-backend.md`'s own design already assumes "close
  enough," not perfect sync — this phase's manual/Playwright tests use a
  tolerance (<20ms per `04-roadmap.md`), not exact equality.
- [Risk] The fixed track roster is a naming decision this design invents,
  not one derived from existing docs → Mitigation: confirmed with the
  user before drafting rather than silently assumed; easy to rename
  later since nothing else depends on the specific names yet.
- [Risk] This is the largest phase yet — ownership, ID assignment,
  multi-track audio, and clock sync are four fairly separable pieces of
  work bolted together by necessity (the roadmap groups them into one
  phase). → Mitigation: `tasks.md` groups them so ownership and clock
  sync can be implemented and tested somewhat independently, and apply
  can pause between groups without losing partial progress.
- [Risk] Background-tab throttling (browsers slow `setTimeout` in
  inactive tabs) could make the `beforeStart` delay fire very late if a
  client's tab isn't focused when their track's start time arrives →
  Mitigation: not solved in this phase; noted for awareness during
  manual testing, revisit if it's a real problem in practice.
- [Risk] `vitest`'s default test glob also matches `*.spec.ts`, so it
  tried to load `e2e/multi-client.spec.ts` (a `@playwright/test` file,
  a separate test runner) and failed on the `@playwright/test` import.
  → Mitigation: `vitest.config.ts` now excludes `e2e/**`. First surfaced
  the moment both test setups coexisted in the same repo — a real
  cross-tool config gap, not a flaky test.
- [Risk] The Playwright clock-drift assertion first failed with a fixed
  `waitForTimeout` under CDP-throttled conditions: 750kbit/s throttled
  download made the app bundle take longer to load than the guessed
  delay, so the offset hook wasn't populated yet when read →
  Mitigation: exposed `hasEstimatedOnce()` alongside `getOffset()` on
  `window.__jaimeClock`, and the tests wait on that condition instead of
  a fixed delay.
- [Risk] Adding starter patterns broke an already-passing Playwright
  assertion: it typed into a track's editor without clearing it first,
  which used to work against an empty starter but now appends to
  non-empty content instead of replacing it — the same class of bug
  caught manually during Phase 1. → Mitigation: caught by rerunning the
  full suite after the change (not assumed safe), fixed by selecting all
  before typing in the affected test.
