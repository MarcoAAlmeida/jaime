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
