> Prerequisite: `add-strudel-parity` applied and archived — the shared
> editor factory exists and JAM is green on it. `yjs` /
> `y-codemirror.next` / `y-protocols` are already installed (commit
> `d9a5510`).

## 1. Durable Object authority + protocol

- [x] 1.1 Frame format decided: base64 binary fields inside JSON frames
      (`shared/compositionProtocol.ts`). Raw-binary-over-crossws +
      hibernation not worth de-risking for tiny payloads; recorded in
      `design.md` decision 2.
- [x] 1.2 `shared/compositionProtocol.ts` — `join` / `y-update` /
      `awareness` / `role` / `eval` / `stop` / `chat` / `clock_ping`
      (client), `welcome` / `y-update` / `awareness` / `presence` /
      `eval` / `stop` / `chat` / `tempo` / `clock_pong` (server), plus
      `toBase64` / `fromBase64` helpers.
- [x] 1.3 `server/routes/composition.ts` (sibling handler, route
      `/composition`). `rooms: Map<id, { ydoc, bpm, cycleStartTimestamp,
      playing, evalAtCycle, presence, chat, timers }>`. On `y-update`:
      viewer → dropped; else `Y.applyUpdate` + relay to the
      `composition:<id>` topic. `eval`/`stop`/`chat`/`role`/`clock_ping`
      handled; `clock_pong` reuses JAM's clock-sync path.
- [x] 1.4 `scheduleSnapshot` — `Y.encodeStateAsUpdate` to
      `composition:<id>` (base64), debounced 2s after the last update.
      `loadRoom` seeds `ydoc` from the snapshot (bad snapshot → fresh
      doc). `scheduleEviction` drops the in-memory room 60s after it
      empties; `getRoom` cancels a pending eviction on re-entry.
- [x] 1.5 `join` → `welcome` carries
      `Y.encodeStateAsUpdate(ydoc, clientSV)` (the sync step-2 diff) plus
      `bpm` / `cycleStartTimestamp` / `playing` / `atCycle` / presence
      roster / chat. Full `y-protocols/sync` two-way is on the client
      provider (2.1); the server side only needs the one-way diff.
- [x] 1.6 `test/composition.test.ts` (5): two editors' concurrent
      edits converge; a viewer's `y-update` is dropped; the doc is
      snapshotted to durable storage (read back + decoded) while chat is
      not; chat/playback clear when the room empties; `eval`/`chat`
      broadcast to the room. 81 vitest total.

## 2. Client editor + collaborative doc

- [x] 2.1 `app/lib/compositionProvider.ts` — `createCompositionProvider`:
      `ydoc.on('update')` → `y-update` frame; incoming → `Y.applyUpdate`
      (origin `'remote'` so it doesn't echo); `y-protocols/awareness`
      relayed; reconnect with 1.5s backoff + re-join + re-sync; own
      `clock_ping`/`clock_pong` offset (15s); emits ready / presence /
      playing / eval / stop / chat / tempo / status. Also:
      `transportClock.ts` split into `waitForCycleBoundary(cst, bpm,
      offset)` + the JAM wrapper; `createStrudelEditor` gains a
      `beforeStart?` option (default = JAM's). 29 clock/room/composition
      tests green.
- [x] 2.2 `app/pages/app/composition/[id].vue` (+ index/create) — real
      room: `add-strudel-parity`'s editor factory for the shared doc
      (`initialCode` from the synced `Y.Text`, or a starter pattern the
      first-in client seeds), `yCollab(ytext, awareness, { undoManager })`
      appended via `StateEffect.appendConfig`, backdrop draw canvas
      mounted (same TrackEditor layout), `beforeStart` closes over the
      provider's own clock + ping/pong offset via the new
      `waitForCycleBoundary`. Ctrl-Enter/Ctrl-. route through
      `onRequestPlay`/`onRequestStop` to `provider.sendEval`/`sendStop`;
      `provider.on('eval'|'stop')` drives the actual repl. Found + fixed
      along the way: `primeAudio()` was awaited before editor creation,
      so the editor never mounted until a click happened — fixed to fire
      it without blocking (mirrors the JAM room page); the global
      `/room` WebSocket plugin was matching on `route.params.id`, which
      also exists on this route, opening a phantom JAM room per
      Composition Room visit — restricted it to `/app/jam/room/*`.
- [x] 2.3 `app/pages/app/composition/index.vue` — create + join-by-link
      (mirrors JAM's entry point); room id in the URL; the room page's
      "Copy invite link" button. Opening the same link lands in the same
      room over the same doc (verified by 2.4 and manually).
- [x] 2.4 Concurrent-edit behaviour verified (`e2e/composition.spec.ts`,
      3 tests, all green): two browser contexts, simultaneous inserts at
      different positions both survive and the docs converge; a late
      joiner loads the current document; local unsent edits are rebased
      over a remote change losing neither side. (Reading `.cm-content`
      directly picks up y-codemirror.next's remote-cursor name label as
      text — `docText()` strips `.cm-ySelectionCaret` widgets before
      comparing.) Manually verified eval/stop broadcasts and flips the
      Play/Stop button on both clients.

## 3. Roles, presence, cursors

- [x] 3.1 Editor/viewer chosen on a second join gate (`role-editor` /
      `role-viewer`), after the name gate. Role rides in the `join`
      frame + the presence roster; the room's "Switch to viewer/editor"
      button calls `provider.setRole()` and reconfigures the factory's
      editable compartment via `editor.setEditable()` — no rejoin,
      verified by e2e (viewer→editor then edits land).
- [x] 3.2 A viewer's editor mounts with `editable: false`, so CodeMirror
      rejects input transactions (no local edit, no `y-update` out), and
      the server's viewer `y-update` drop (1.3) is the backstop. A
      viewer also has no Play button and `requestEval`/`requestStop`
      no-op. e2e types "SNEAKY" as a viewer and the doc is unchanged for
      everyone.
- [x] 3.3 `provider.on('presence')` → a roster aside (name + role
      badge, count), room-scoped by the `composition:<id>` topic,
      updates on join and on leave. e2e checks both.
- [x] 3.4 `yCollab` brings `yRemoteSelections`; colour is
      `cursorColor(ydoc.clientID)` (hashed into an 8-colour palette in
      compositionProvider.ts), name from the awareness `user` field.
      Remap-on-edit is y-codemirror.next's. Removal on leave needed a
      protocol addition: `join` carries `awarenessId`, and the server's
      `close` broadcasts `{ t: 'peer_left', awarenessId }` so the
      provider calls `removeAwarenessStates` immediately rather than
      waiting for the 30s outdated-state sweep. e2e: B sees A's
      name-labelled caret, and it's gone once A closes.

## 4. Synced playback + chat

- [x] 4.1 Ctrl-Enter / the Play button call `provider.sendEval(atCycle)`
      (`atCycle` = next cycle boundary on the room clock); `provider.on
      ('eval')` on every client — editors **and** viewers — calls
      `editor.evaluate()`, whose `beforeStart` waits for that client's
      own next boundary. `stop` symmetric. e2e: one editor plays, the
      other editor's button flips to Stop and all three clients
      (including the viewer) paint their `.punchcard()` backdrop.
- [x] 4.2 The `playing` flag from the `welcome` is remembered
      (`playingOnJoin`); right after the editor + yCollab are built, a
      late joiner calls `editor.evaluate()` once so it locks onto the
      running document with no one re-triggering. e2e covers a viewer
      joining a playing room.
- [x] 4.3 `createStrudelEditor`'s `onEvalError` → an `error` ref → a
      "Pattern error" `UAlert`; the error is per-client (a document
      syntax error shows for everyone). `evaluate()` clears it and the
      engine keeps working — e2e evaluates a broken doc (error on both
      clients) then a good one (paints, error gone).
- [x] 4.4 Chat panel in the room aside: `provider.on('chat')` appends to
      a list (auto-scrolled), `chat-input` + Send call
      `provider.sendChat`. Server-side the chat is in-memory only and
      cleared when the room empties (1.3/1.6). Attributed to the
      sender's display name.
- [x] 4.5 `e2e/composition.spec.ts` — 10 tests: concurrent inserts
      converge; late joiner loads the doc; unsent edits rebase; roster +
      roles + leave; viewer read-only + role switch; live cursor
      labelled + removed on leave; room-wide synced eval (editor +
      viewer paint); late joiner catches playback; pattern error on all
      + recovery; chat crosses + gone once the room empties (doc
      persists). All green; JAM + strudel-parity e2e unaffected.

## 5. Cutover

- [ ] 5.1 Route the real room at `/app/composition`; delete
      `app/pages/app/composition-room.vue` and its mock testids from
      `e2e/` where they only covered the mock.
- [ ] 5.2 Sidebar / dashboard entry points to the Composition Room
      (create + recent), consistent with JAM's.
- [ ] 5.3 `openspec/specs/hub-mock-screens/` — the delta retires the
      last requirement; the sync deletes the spec.

## 6. Verification + deploy

- [ ] 6.1 `nuxt typecheck`, `npm test`, `playwright test` all green.
- [ ] 6.2 Manual against `wrangler dev`: three browser contexts in one
      Composition Room — two editors + a viewer — merged editing, live
      cursors, one evaluates and all three hear it in sync, chat,
      restart-persistence of the doc.
- [ ] 6.3 `npm run deploy`; on `https://jaime.stream` run the same
      three-client check live, plus confirm JAM still plays every
      curated pattern.

## 7. Spec sync + archive

- [ ] 7.1 `openspec validate add-composition-room --strict`.
- [ ] 7.2 Sync deltas: new `composition-room` spec; `hub-mock-screens`
      retired. Archive the change.
- [ ] 7.3 `docs/04-roadmap/index.md` + `AGENTS.md` — Phase 6 shipped;
      note Phase 7 (AI in the chat panel) is next.
- [ ] 7.4 `docs/05-domain-model/index.md` — reconcile decision 2 / 10
      with the Yjs choice (the `Document` entity is a Y.Doc snapshot,
      not a `@codemirror/collab` changeset log).
