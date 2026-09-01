> Prerequisite: `add-strudel-parity` applied and archived — the shared
> editor factory exists and JAM is green on it. `yjs` /
> `y-codemirror.next` / `y-protocols` are already installed (commit
> `d9a5510`).

## 1. Durable Object authority + protocol

- [ ] 1.1 Spike: confirm crossws passes binary (`ArrayBuffer` /
      `Uint8Array`) frames through `peer.send` / `message`, or fall
      back to base64. Record the frame format in `design.md` decision 2.
- [ ] 1.2 `shared/compositionProtocol.ts` — message types: `join`
      (role), `y-sync`, `y-update`, `y-awareness`, `presence`, `eval`,
      `stop`, `chat`.
- [ ] 1.3 In `server/routes/room.ts` (or a sibling handler) add a
      composition branch: `compositions: Map<roomId, { ydoc, bpm,
      cycleStartTimestamp, presence, chat }>`. On `y-update`:
      `Y.applyUpdate` + relay to the room topic. Drop `y-update` from a
      connection currently marked `viewer`.
- [ ] 1.4 Snapshot `Y.encodeStateAsUpdate(ydoc)` to
      `getDurableStorage()` key `composition:<id>`, debounced ~2s; seed
      a room's `ydoc` from the snapshot on first access; evict idle
      rooms after a quiet period (JAM-room lifecycle shape).
- [ ] 1.5 `y-sync` handshake (`y-protocols/sync`) on connect; late
      joiner gets the current doc state + `{ playing, atCycle }`.
- [ ] 1.6 Unit tests (pool-workers): two simulated clients' updates
      converge server-side; a viewer's update is dropped; a snapshot
      round-trips a document across a simulated restart; presence/chat
      do not persist.

## 2. Client editor + collaborative doc

- [ ] 2.1 `app/lib/compositionProvider.ts` — a thin Yjs provider over
      the room WebSocket: `ydoc.on('update')` → frame; incoming frame →
      `Y.applyUpdate`; `y-protocols/awareness` wired; reconnect-safe.
- [ ] 2.2 `app/pages/app/composition/[id].vue` (+ index/create) — real
      room: `add-strudel-parity`'s editor factory for the shared doc,
      `yCollab(ytext, awareness, { undoManager })` appended via
      `StateEffect.appendConfig`, draw canvas mounted, `beforeStart:
      waitForSynchronizedStart`.
- [ ] 2.3 Create + join-by-link + "copy invite link"; room id in the
      URL; opening the same link lands in the same room over the same
      doc.
- [ ] 2.4 Concurrent-edit behaviour verified: two browser contexts,
      simultaneous inserts at different positions both survive and the
      docs converge; same-region edits reconcile with neither lost
      without a trace; local unsent edits rebased over a remote change.

## 3. Roles, presence, cursors

- [ ] 3.1 Editor/viewer chosen on join (self-declared); role in
      awareness; `EditorView.editable` compartment reconfigured live on
      role switch, no rejoin.
- [ ] 3.2 A viewer's editor is strictly read-only — no local edit
      lands, no `y-update` leaves; server-side drop as the backstop
      (1.3).
- [ ] 3.3 Presence roster (name + role), room-scoped, updates as people
      join/leave.
- [ ] 3.4 Live remote cursors/selections via `yRemoteSelections` — per
      person name + colour (palette hashed on client id), correctly
      remapped as the doc changes, removed when an editor leaves.

## 4. Synced playback + chat

- [ ] 4.1 `eval` / `stop` broadcast `{ atCycle }` (not the code);
      every client — editors and viewers — evaluates its local Y.Text
      and starts/stops aligned to the shared cycle boundary.
- [ ] 4.2 Late joiner of a playing room starts playback of the current
      doc locked to the clock, with no re-trigger.
- [ ] 4.3 Per-client eval-error surfacing in the editor; the engine
      stays usable for the next eval.
- [ ] 4.4 Ephemeral room chat — panel beside the editor, messages to
      everyone connected, attributed to the sender's display name, not
      persisted (empty after restart / when the room empties).
- [ ] 4.5 e2e (`e2e/composition.spec.ts`): two contexts — merged edits
      converge; a viewer can't edit; a cursor is visible to the other;
      one evaluates and both are playing; a chat message crosses; a
      reload of the link shows the persisted doc but empty chat.

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
