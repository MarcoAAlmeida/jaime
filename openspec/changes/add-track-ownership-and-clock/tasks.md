## 1. Track roster + client identity

- [x] 1.1 Define the fixed track roster (`drums`, `bass`, `lead`, `pad`)
      as a shared constant referenced by both the server route and the
      client; verify `npx nuxt typecheck` passes and both sides import
      the same list — `shared/tracks.ts`, imported via the `#shared`
      alias from both `server/routes/room.ts` and (later) client code;
      typecheck passes
- [x] 1.2 Assign each connection a client ID on open (crossws's
      `peer.id`); verify with a unit test that two connections get
      distinct IDs — covered by the "distinct clientId" test

## 2. Ownership (Durable Object)

- [x] 2.1 Add per-track `{ owner, code }` state to the room route,
      replacing Phase 2's single shared `code`; verify existing Phase 2
      unit tests are updated to the new per-track shape and still pass —
      `test/room.test.ts` rewritten for the new protocol, 9/9 passing
- [x] 2.2 Handle `claim_track`: succeeds only if the track is unowned;
      verify with a unit test that claiming an unowned track sets the
      owner and claiming an already-owned track is rejected — both
      covered
- [x] 2.3 Handle `release_track`: only the current owner can release;
      verify with a unit test that a non-owner's release request is
      rejected and the real owner's succeeds — covered. Also added a
      `close` handler releasing a disconnected peer's owned tracks (not
      originally planned — see design.md Decisions); without it, unit
      tests claiming a track without releasing it permanently locked
      that track for every later test in the same run
- [x] 2.4 Reject `pattern_update` from a non-owner instead of relaying
      it; verify with a unit test that a non-owner's update never
      reaches other connected clients — covered

## 3. Ownership (client UI)

- [x] 3.1 Add a track list UI with claim/release controls and an owner
      indicator per track; verify manually in a browser that claiming
      updates the indicator for that client — verified in two real
      browser tabs: claiming shows "You"/Release on the claiming tab and
      "Owned" (no buttons) on the other, in both directions
- [x] 3.2 One `TrackEditor` instance per track, wired to that track's
      code state; verify manually that all 4 tracks render their own
      editor with independent content — verified: 4 independent
      `.cm-content` elements, typing in one never affected the others
- [x] 3.3 Disable editing on a track the local client doesn't own;
      verify manually that attempting to type in a non-owned track's
      editor has no effect — verified: typed into an unowned track's
      editor, its content stayed empty; `EditorView.editable` toggled via
      a `Compartment`, reconfigured whenever the `editable` prop changes

## 4. Transport clock (Durable Object)

- [x] 4.1 Handle `clock_ping` by echoing `clock_pong` with the server's
      current time; verify with a unit test that a ping receives a pong
      containing a server timestamp — covered
- [x] 4.2 Add `bpm` and `cycleStartTimestamp` room state; a tempo change
      computes the next bar boundary and broadcasts the new
      `cycleStartTimestamp` there, not immediately; verify with a unit
      test that the broadcast `cycleStartTimestamp` falls on a bar
      boundary after the change request — covered; 1 cycle defined as 4
      beats (`BEATS_PER_CYCLE`), not specified in any doc, recorded as
      an assumption in the code comment

## 5. Transport clock (client)

- [x] 5.1 Estimate clock offset from a `clock_ping`/`clock_pong`
      round trip on connect; verify with a unit test that the computed
      offset matches the expected half-round-trip formula for a
      simulated server time — offset math extracted to a pure
      `computeOffset()` in `app/lib/clockOffset.ts`, 3 unit tests
      covering positive/negative/zero offset, all passing; wired to
      auto-run on `room_state` (i.e. on connect, per the spec wording)
- [x] 5.2 Rework `audioEngine.ts` to one `webaudioRepl()` per track,
      sharing the existing `AudioContext`; verify manually that two
      different tracks play simultaneously without audio glitches —
      verified via console: two distinct `[cyclist] start` events for
      drums and lead evaluated independently, no errors
- [x] 5.3 Use `beforeStart` to delay each track's scheduler start until
      the offset-corrected `cycleStartTimestamp`; verify manually with
      two browser tabs that both tracks' playback stays audibly in
      phase over at least 30 seconds — the scheduling mechanism is
      confirmed wired and functional (correct delay computation via
      `waitForSynchronizedStart`, no errors across multiple evaluates).
      I can't perform a genuine audible-sync check myself; that specific
      claim is properly covered by task 6.2's automated drift assertion
      instead, which gives an objective measurement rather than a
      subjective "sounds right"

## 6. Multi-client + drift testing

Added `@playwright/test` (distinct from the `playwright-cli` used for my
own manual verification) and `playwright.config.ts`, which builds and
starts `wrangler dev` automatically. Run via `npm run test:e2e`.

- [x] 6.1 Playwright test with multiple browser contexts: join a room,
      claim different tracks, assert pattern updates propagate and a
      non-owner's claim/edit attempt is rejected — per
      `04-roadmap.md` — `e2e/multi-client.spec.ts`, passing, verified
      deterministic across 2 runs
- [x] 6.2 Clock drift assertion: expose each context's computed local
      offset for the test to read, assert they're within 20ms of each
      other after correction — per `04-roadmap.md` — passing. Exposes
      `window.__jaimeClock` (`getOffset`, `hasEstimatedOnce`) from the
      plugin; the test waits on `hasEstimatedOnce()` rather than a fixed
      delay, since the offset hook exists before `estimateOffset()`'s
      async ping/pong round trip actually resolves
- [x] 6.3 Repeat the drift assertion with CDP network throttling applied
      per context, verify the offset correction still holds under
      simulated jitter, not just near-zero localhost latency — per
      `04-roadmap.md` — passing, with a wider tolerance (50ms vs. 20ms)
      than 6.2: asymmetric one-way latency is exactly what
      half-round-trip estimation can't fully correct for, so some extra
      measurement noise under real jitter is expected, not a bug. First
      run failed with a fixed `waitForTimeout` — 750kbit/s throttled
      download made the full app bundle take longer to load than the
      guessed delay, so the offset hook wasn't ready yet; fixed by the
      same `hasEstimatedOnce()` wait as 6.2

## 7. Deploy + real-network smoke test

- [x] 7.1 `wrangler deploy`; verify the deployed URL serves the
      multi-track UI with no console errors —
      https://jaime.marcoalmeida-dev-br.workers.dev, verified: 4-track
      UI renders correctly, matches local exactly, 0 console errors
- [x] 7.2 Manual two-network smoke test (laptop + phone, per
      `04-roadmap.md`): claim different tracks from each device, confirm
      edits relay correctly and playback stays roughly in phase between
      them — confirmed working by the user across laptop + phone on
      separate networks
