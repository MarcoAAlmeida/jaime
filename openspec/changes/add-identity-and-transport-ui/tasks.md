## 1. Protocol + server: named presence

- [x] 1.1 `shared/roomProtocol.ts`: `room_state`'s `presence` becomes
      `Array<{ clientId: string, name: string }>` (was `string[]`);
      `presence_update` becomes a discriminated union —
      `{ clientId, joined: true, name }` or `{ clientId, joined: false }`
      — added a `PresenceEntry` type for the `{clientId, name}` shape
- [x] 1.2 `server/routes/room.ts`: `RoomState.presence` becomes
      `Map<clientId, name>` (was `Set<clientId>`); read `name` from
      `new URL(peer.request.url).searchParams` in `open(peer)` alongside
      the existing room ID; reject the connection (same as a missing
      room ID) if `name` is missing or empty after trimming
- [x] 1.3 Verify with unit tests: a room's presence roster carries names;
      a connection with no `name` query param is rejected the same way
      one with no `id` already is — 3 new tests passing (missing name,
      empty/whitespace name, presence carries correct names per client)

## 2. Client: display name capture + join gate

- [x] 2.1 Add a small composable/util backed by `sessionStorage` for
      getting/setting the current session's display name (per design.md
      — `sessionStorage`, not `localStorage`) — `app/composables/useDisplayName.ts`
- [x] 2.2 `app/pages/room/[id].vue`: render a name-entry prompt in place
      of the room UI when no display name is set yet, matching the
      existing `audioUnlocked` inline-gate pattern already in that file;
      reveal the room once a name exists
- [x] 2.3 `app/plugins/websocket.client.ts`: the connection `watch()`
      depends on both the route's room ID and the display name — the
      WebSocket doesn't open until both exist; the connect URL includes
      `&name=<name>`
- [x] 2.4 Verify manually in a browser: opening a room with no stored
      name shows the prompt first; the room's WebSocket doesn't connect
      until a name is submitted — verified via the new Playwright test
      (group 5); no interactive browser tool was available this session
      for a literal manual check

## 3. Client: presence and ownership show names

- [x] 3.1 `app/composables/useJamSession.ts`: `presence` becomes
      `Ref<Array<{ clientId: string, name: string }>>`
      (was `Ref<string[]>`) — uses the new `PresenceEntry` type from
      `shared/roomProtocol.ts`
- [x] 3.2 `app/plugins/websocket.client.ts`: handle the updated
      `room_state`/`presence_update` shapes
- [x] 3.3 `app/pages/room/[id].vue`: presence display shows names, not
      just a count; the owner badge resolves a track's `owner` (still a
      connection ID) to a display name via a lookup in `presence`, shown
      instead of the current generic "Owned" label — kept "You" for the
      local client's own claims, owner's name for tracks claimed by
      someone else
- [x] 3.4 Verify manually in a browser with two tabs using different
      names — verified via the new Playwright test (group 5); no
      interactive browser tool was available this session

## 4. Transport bar

- [x] 4.1 `app/pages/room/[id].vue`'s header gains a compact tempo
      control: shows the current `bpm` (already tracked in
      `useJamSession`) and lets a user change it, calling the existing
      `sendSetTempo` from `app/plugins/websocket.client.ts` — a number
      input plus a "Set" button; local input follows remote tempo
      changes via a `watch(bpm, ...)` (simple last-write-wins, not
      protecting an in-progress local edit — acceptable for this scope)
- [x] 4.2 Verify manually with two tabs: changing tempo on one updates
      the displayed BPM on the other — verified via the new Playwright
      test (group 5); no interactive browser tool was available this
      session

## 5. Testing

- [x] 5.1 Update `test/room.test.ts`'s `connect()` helper to include a
      `name` query param, since a connection without one is now rejected
      per 1.2; give each test's connections distinct, readable names —
      `connect(roomId, name = 'Test User')`; presence-focused tests pass
      explicit names ('Alice'/'Bob')
- [x] 5.2 Unit test: presence roster entries carry the correct name for
      each connected client — done as part of 1.3
- [x] 5.3 Unit test: a connection with a missing or empty `name` is
      rejected — done as part of 1.3
- [x] 5.4 Playwright: two clients set different display names; each
      sees the other's name in the presence list and, after one claims a
      track, in that track's owner badge — new test
      `presence and track ownership show each client's display name`,
      passing. Also required updating every existing multi-client test:
      the join gate now sits in front of every room, so `createRoom()`
      and a new `joinRoomById()` helper submit a name before any room
      assertion runs, and owner-badge assertions that expected the
      generic "Owned" text now expect the actual name
- [x] 5.5 Playwright: one client changes tempo; the other sees the
      displayed BPM update — new test
      `changing tempo updates the displayed BPM for every client`,
      passing
- [x] 5.6 Full suite passes: `npx nuxt typecheck`, `npx vitest run`,
      `npx playwright test` — no regressions; 24/24 unit, 11/11 e2e. One
      real behavior change found and fixed during this pass, not a test
      bug: the join gate's own click now satisfies the browser's
      audio-unlock gesture before the room renders, so that banner's
      test had to target the one case where it can still appear (a
      second room in the same tab, name already in `sessionStorage`, no
      prior click on that fresh page load) — see design.md's Risks

## 6. Deploy + verify

- [x] 6.1 `wrangler deploy` — https://jaime.marcoalmeida-dev-br.workers.dev,
      landing page and a room page both verified returning 200; also ran
      a raw two-connection WebSocket check against this exact deployment
      (`name=Alice`/`name=Bob`) confirming `room_state` and
      `presence_update` both carry the correct names over the real
      network
- [ ] 6.2 Manual two-device smoke test: set distinct display names on
      each, confirm both show up correctly in presence and in track
      ownership, and that a tempo change on one device is reflected on
      the other
