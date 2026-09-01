## 1. Engine parity — foundation (also lands in JAM)

- [ ] 1.1 Add deps: `@strudel/draw` (use it), `yjs`, `y-codemirror.next`,
      `y-protocols`. Confirm they bundle under the Cloudflare/Nitro
      client build.
- [ ] 1.2 Spike (design open question): stand up one `StrudelMirror`
      with `solo:false` + a jaime `prebake()` in a throwaway route,
      play a few patterns, check the theme hijack workaround and the
      `start-repl` solo event don't misbehave with more than one
      instance. Decide: N `StrudelMirror` for JAM vs. bespoke repl +
      parity pieces. Record the decision in `design.md`.
- [ ] 1.3 `app/lib/prebake.ts` — register the strudel.cc default sample
      map (`samples(url)` for Dirt-Samples + VCSL + tidal-drum-machines
      + EmuSP12 + mridangam + the rest strudel.cc bakes). One lazily
      awaited promise, shared by every repl; a synth-only pattern must
      still play without awaiting it.
- [ ] 1.4 Rework `app/lib/audioEngine.ts` to the chosen path: a
      `StrudelMirror` (or parity-augmented repl) factory that takes a
      root element, a draw canvas, and `beforeStart:
      waitForSynchronizedStart`; keeps the singleton `AudioContext`;
      exposes evaluate / stop / error per instance.

## 2. Engine parity — features + JAM regression gate

- [ ] 2.1 JAM tracks use the new engine — one instance per track,
      `solo:false`. `app/components/TrackEditor.vue` mounts it (or a
      new shared editor component); external code updates still apply
      without echoing `update:code`.
- [ ] 2.2 Mini-notation event highlighting visible in each track editor
      during playback, cleared on stop (`@strudel/codemirror` highlight
      wiring that `StrudelMirror` already drives).
- [ ] 2.3 Pattern-driven visuals — `punchcard` / `pianoroll` / `scope`
      / `spectrum` / `markcss` draw to a per-editor canvas when the
      pattern calls them, nothing shown when it doesn't.
- [ ] 2.4 `$:` / labelled multi-pattern documents evaluate (all labels
      play); per-label mute/solo without re-evaluation. Confirm a
      JAM track can hold a multi-label document.
- [ ] 2.5 `setcps` honoured for a standalone eval; ignored (shared
      clock wins) inside a tempo-synced room.
- [ ] 2.6 Regression gate: `e2e/pattern-playback.spec.ts` (every
      curated pattern plays), `e2e/multi-client.spec.ts`,
      `e2e/pattern-loading.spec.ts`, `nuxt typecheck`, `vitest run` all
      green with the new engine.

## 3. Composition room — Durable Object authority

- [ ] 3.1 `shared/compositionProtocol.ts` — message types: `join`
      (role), `y-sync`, `y-update`, `y-awareness`, `presence`, `eval`,
      `stop`, `chat`. Decide raw-binary vs. base64 frames (spike) and
      document it.
- [ ] 3.2 In `server/routes/room.ts` (or a sibling handler) add a
      composition branch: `compositions: Map<roomId, { ydoc, bpm,
      cycleStartTimestamp, presence, chat }>`. On `y-update`:
      `Y.applyUpdate` + relay to the room topic. Drop `y-update` from a
      connection currently marked `viewer`.
- [ ] 3.3 Snapshot `Y.encodeStateAsUpdate(ydoc)` to
      `getDurableStorage()` key `composition:<id>`, debounced ~2s;
      seed a room's `ydoc` from the snapshot on first access; evict
      idle rooms after a quiet period (JAM-room lifecycle shape).
- [ ] 3.4 `y-sync` handshake (`y-protocols/sync`) on connect; late
      joiner gets the current doc state + `{ playing, atCycle }`.
- [ ] 3.5 Unit tests (pool-workers): two simulated clients' updates
      converge server-side; a viewer's update is dropped; a snapshot
      round-trips a document across a simulated restart; presence/chat
      do not persist.

## 4. Composition room — client editor + collaborative doc

- [ ] 4.1 `app/lib/compositionProvider.ts` — a thin Yjs provider over
      the room WebSocket: `ydoc.on('update')` → frame; incoming frame →
      `Y.applyUpdate`; `y-protocols/awareness` wired; reconnect-safe.
- [ ] 4.2 `app/pages/app/composition/[id].vue` (+ index/create) — real
      room: one `StrudelMirror` for the shared doc, `yCollab(ytext,
      awareness, { undoManager })` appended via
      `StateEffect.appendConfig`, draw canvas mounted, `beforeStart:
      waitForSynchronizedStart`.
- [ ] 4.3 Create + join-by-link + "copy invite link"; room id in the
      URL; opening the same link lands in the same room over the same
      doc.
- [ ] 4.4 Concurrent-edit behaviour verified: two browser contexts,
      simultaneous inserts at different positions both survive and the
      docs converge; same-region edits reconcile with neither lost
      without a trace; local unsent edits rebased over a remote change.

## 5. Roles, presence, cursors

- [ ] 5.1 Editor/viewer chosen on join (self-declared); role in
      awareness; `EditorView.editable` compartment reconfigured live on
      role switch, no rejoin.
- [ ] 5.2 A viewer's editor is strictly read-only — no local edit
      lands, no `y-update` leaves; server-side drop as the backstop
      (3.2).
- [ ] 5.3 Presence roster (name + role), room-scoped, updates as people
      join/leave.
- [ ] 5.4 Live remote cursors/selections via `yRemoteSelections` — per
      person name + colour (palette hashed on client id), correctly
      remapped as the doc changes, removed when an editor leaves.

## 6. Synced playback + chat

- [ ] 6.1 `eval` / `stop` broadcast `{ atCycle }` (not the code);
      every client — editors and viewers — evaluates its local Y.Text
      and starts/stops aligned to the shared cycle boundary.
- [ ] 6.2 Late joiner of a playing room starts playback of the current
      doc locked to the clock, with no re-trigger.
- [ ] 6.3 Per-client eval-error surfacing in the editor; the engine
      stays usable for the next eval.
- [ ] 6.4 Ephemeral room chat — panel beside the editor, messages to
      everyone connected, attributed to the sender's display name, not
      persisted (empty after restart / when the room empties).
- [ ] 6.5 e2e (`e2e/composition.spec.ts`): two contexts — merged edits
      converge; a viewer can't edit; a cursor is visible to the other;
      one evaluates and both are playing; a chat message crosses; a
      reload of the link shows the persisted doc but empty chat.

## 7. Cutover

- [ ] 7.1 Route the real room at `/app/composition`; delete
      `app/pages/app/composition-room.vue` and its mock testids from
      `e2e/` where they only covered the mock.
- [ ] 7.2 Sidebar / dashboard entry points to the Composition Room
      (create + recent), consistent with JAM's.
- [ ] 7.3 `content/docs/strudel/4.in-jam.md` → "Strudel in jaime":
      drop the "curated subset / leaves out" framing; keep an honest
      short list of real exceptions (Hydra, MIDI, room-loaded sample
      banks). Update `2.strudel.md` / `3.sounds.md` where they say
      "the four basic waveforms" / "dirt-samples" if parity changes
      that.
- [ ] 7.4 `openspec/specs/hub-mock-screens/` — the delta retires the
      last requirement; the sync deletes the spec.

## 8. Verification + deploy

- [ ] 8.1 `nuxt typecheck`, `npm test`, `playwright test` all green.
- [ ] 8.2 Manual against `wrangler dev`: three browser contexts in one
      Composition Room — two editors + a viewer — merged editing, live
      cursors, one evaluates and all three hear it in sync, chat,
      restart-persistence of the doc.
- [ ] 8.3 `npm run deploy`; on `https://jaime.stream` run the same
      three-client check live, plus confirm JAM still plays every
      curated pattern.

## 9. Spec sync + archive

- [ ] 9.1 `openspec validate add-composition-room --strict`.
- [ ] 9.2 Sync deltas: new `composition-room` spec; `frontend-editor`
      modified + added requirements merged; `hub-mock-screens` retired.
      Archive the change.
- [ ] 9.3 `docs/04-roadmap/index.md` + `AGENTS.md` — Phase 6 shipped;
      note Phase 7 (AI in the chat panel) is next and the remaining
      engine exceptions (Hydra, MIDI).
- [ ] 9.4 `docs/05-domain-model/index.md` — reconcile decision 2 / 10
      with the Yjs choice (the `Document` entity is now a Y.Doc
      snapshot, not a `@codemirror/collab` changeset log).
