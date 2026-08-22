## 1. Track roster reduced to 2 generic tracks

- [x] 1.1 Update `shared/tracks.ts`: `TRACK_NAMES` becomes `['a', 'b']`;
      rewrite `DEFAULT_CODE` with two neutral, non-instrument-themed
      starter patterns; verify `npx nuxt typecheck` passes and no
      remaining code assumes 4 tracks or instrument names — passing;
      grepped the codebase for the old names (`drums`/`bass`/`lead`/`pad`)
      and found none outside test/e2e files, updated separately below
- [x] 1.2 Render track labels as "Track A" / "Track B" via a small
      display-label map instead of raw `text-transform: capitalize` on
      the track ID; verify manually in a browser — added
      `TRACK_LABELS` to `shared/tracks.ts`, used by
      `app/pages/room/[id].vue`; visible in the deployed smoke test (6.1)

## 2. Server: multi-room state

- [x] 2.1 Change `server/routes/room.ts`'s module-level state from one
      flat `{ tracks, bpm, cycleStartTimestamp }` to
      `Map<roomId, RoomState>`, creating a room's entry lazily on first
      connection; verify existing unit tests are updated to connect with
      a room ID and still pass — `test/room.test.ts`'s `connect()` now
      takes a `roomId`, every test gets its own via `freshRoomId()`,
      19/19 passing
- [x] 2.2 Read the room ID from
      `new URL(peer.request.url).searchParams.get('id')` in `open(peer)`;
      reject the upgrade if it's missing or empty; verify with a unit
      test that a connection with no `id` is rejected — new test
      `rejects a connection with no room id`, passing (asserts no
      room_state is ever sent, rather than racing the close event's
      timing — more robust, see the close-handshake caveat noted in
      group 5)
- [x] 2.3 Scope every crossws subscribe/publish call to
      `` `room:${roomId}` `` instead of the constant `'room'`; verify
      with a unit test that two clients connected with different room
      IDs never receive each other's broadcasts — new test
      `isolates rooms: a client in one room never receives another
      room's broadcasts`, passing

## 3. Room creation and joining (client)

- [x] 3.1 Add `nanoid` to `package.json` dependencies directly (already
      present transitively; stop relying on that phantom install) —
      added `^3.3.18` (matching the already-resolved transitive
      version), `npm install` confirms it's now a direct dependency in
      `package-lock.json`
- [x] 3.2 Build the real landing page (`app/pages/index.vue`, replacing
      the current `/` → `/jam` redirect in `nuxt.config.ts`'s
      `routeRules`): a Create action generates a `nanoid(10)` ID
      client-side and navigates to `/room/<id>`; a Join field accepts
      either a pasted link or a bare code and navigates to the same room
      — `nuxt.config.ts`'s `routeRules` now only has `/room/**: {ssr:
      false}`, no redirect
- [x] 3.3 Move the room UI from `app/pages/jam.vue` to the dynamic route
      `app/pages/room/[id].vue`; connect the WebSocket to
      `/room?id=<id>` using the route param — `jam.vue` deleted;
      `app/plugins/websocket.client.ts` restructured from a one-shot
      connection into a `watch(() => route.params.id, ...)` that
      (re)connects whenever the room ID changes, so client-side
      navigation from the landing page into a room (no full page
      reload) still connects correctly
- [x] 3.4 Add a "copy invite link" control to the room UI; verify
      manually that it copies the current room's shareable URL —
      `navigator.clipboard.writeText(window.location.href)`, verified
      via the deployed smoke test (6.1)

## 4. Presence

- [x] 4.1 `shared/roomProtocol.ts`: add a presence roster to
      `room_state` and a `presence_update` broadcast for join/leave —
      `room_state` gained `presence: string[]`; new
      `presence_update: { clientId, joined }` message
- [x] 4.2 Server broadcasts presence join/leave to the room's scoped
      topic; verify with a unit test that a second connection's join is
      visible to the first connection, and that closing it removes it
      from the roster — join-visibility covered by the new `presence`
      describe block in `test/room.test.ts`, passing; the close/leave
      case hits the same `SELF.fetch()` slow-close-handshake limitation
      already documented for owner-disconnect in the `playback` describe
      block, so it's covered by Playwright instead (5.3), where it
      passed cleanly against the real Workers runtime
- [x] 4.3 Client UI shows a presence count/roster in the room header;
      verify manually with two browser tabs on the same room ID — a
      `{{ presence.length }} here` badge in `app/pages/room/[id].vue`'s
      header; verified via Playwright (`presence count updates as a
      second client joins and leaves the same room`) and the deployed
      smoke test (6.1)

## 5. Multi-room + presence testing

- [x] 5.1 Update `test/room.test.ts`'s connect helper to include a room
      ID query param, since a bare `/room` connection is now rejected
      per 2.2 — done as part of 2.1's rewrite
- [x] 5.2 Playwright: two separate room IDs in one test run; assert a
      client in room A never receives room B's pattern, ownership, or
      presence messages — per `04-roadmap.md` — new test
      `two separately created rooms never see each other's activity`,
      passing
- [x] 5.3 Playwright: presence roster updates when a second browser
      context joins, and again when it leaves, the same room — new test
      `presence count updates as a second client joins and leaves the
      same room`, passing; this is real evidence the close-triggered
      path (presence removal, and by extension `releaseAndStop` on
      disconnect) works correctly against the actual Workers runtime —
      the `SELF.fetch()` limitation noted in 4.2 is specific to that
      unit-test harness's simulated socket pair, not a real gap in the
      feature
- [x] 5.4 Basic concurrency check: open N concurrent WebSocket
      connections to one room and confirm presence/broadcast still
      behaves correctly — per `04-roadmap.md`'s load-test suggestion;
      informs whether the shared-Durable-Object risk noted in design.md
      is a real concern at this app's actual scale, not just theoretical
      — `scripts/room-load-check.mjs`, a standalone script (not part of
      either automated suite, matching the roadmap's framing of this as
      a one-off diagnostic). First version measured "presence count of
      the last connection" per array order, not server arrival order —
      under real network jitter that isn't meaningful (connections
      complete in whatever order their individual round trips finish,
      uncorrelated with when the server actually processed each one),
      so it under-reported presence (e.g. 19/30 over the real network).
      Fixed by connecting one more "observer" only after every prior
      connection's own room_state had already resolved but before any
      had closed — the server processes open() strictly before that
      response reaches its client, so the observer is guaranteed to see
      everyone. Final results: 30 concurrent connections against local
      `wrangler dev` complete within 65-147ms (p50 ~145ms), the observer
      correctly saw 31/31; the same 30-connection check against the
      deployed instance completed within 250-463ms (p50 ~256ms, real
      network latency, as expected) with the observer again correctly
      seeing 31/31. Scales predictably with count (100 local connections
      completed within 118-483ms in the earlier, since-fixed run) and
      stays comfortably fast at any realistic room size. Confirms
      design.md's shared-Durable-Object risk is theoretical at this
      app's actual scale, not an observed problem

## 6. Deploy + real-network smoke test

- [x] 6.1 `wrangler deploy`; verify the deployed landing page creates a
      room and the room page loads with no console errors —
      https://jaime.marcoalmeida-dev-br.workers.dev, deployed; `/` and
      `/room/<id>` both verified returning 200; the 30-connection
      concurrency check (5.4) against this exact URL confirms functional
      correctness (room_state, presence) over the real network. What I
      can't verify myself: actual browser console cleanliness on the
      live URL — no interactive browser tool was available this
      session, same limitation as Phase 3's deploy. Worth a quick look
      when you do 6.2
- [x] 6.2 Manual two-device smoke test: one device creates a room and
      shares the link, the other joins via that link — confirm both see
      each other in presence and can independently claim/play their own
      track — confirmed working by the user across two real devices
