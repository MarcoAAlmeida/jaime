## 1. Foundation + spike

- [x] 1.1 Deps: `@strudel/draw` promoted to a direct dep;
      `yjs` / `y-codemirror.next` / `y-protocols` also added here (they
      belong to `add-composition-room` but landed together — commit
      `d9a5510`).
- [x] 1.2 Spike done — `nuxt build` bundles `StrudelMirror` +
      `@strudel/draw` under the Cloudflare preset; two `solo:false`
      instances on one page construct and evaluate with zero console
      errors (no theme-hijack breakage, no `start-repl` cross-talk).
      Resolved toward **N `StrudelMirror` for JAM**; recorded in
      `design.md` decision 1 with the `repl()` options needed. Throwaway
      route + spec removed.
- [ ] 1.3 `app/lib/prebake.ts` — one memoised promise registering the
      strudel.cc default sample map (`samples(url)` for Dirt-Samples +
      the drum-machine / VCSL / piano / EmuSP12 sets), each bank in its
      own `try/catch`. Synth-only playback must not await it.
- [ ] 1.4 Editor/engine factory: wraps the chosen path (StrudelMirror
      or parity-augmented repl), taking a root element + a draw canvas +
      `beforeStart: waitForSynchronizedStart`, sharing the singleton
      `AudioContext` and one `prebake()` promise. Preserves today's
      surface: evaluate / stop / last-error per instance, external-code
      apply without echo, the editable compartment.

## 2. Features + JAM regression gate

- [ ] 2.1 JAM tracks use the new engine — one instance per track,
      `solo:false`. `app/components/TrackEditor.vue` (or a new shared
      editor component) mounts it; external code updates still apply
      without re-emitting `update:code`; auto-stop-on-edit still works.
- [ ] 2.2 Mini-notation event highlighting visible in each track editor
      during playback, cleared on stop.
- [ ] 2.3 Pattern-driven visuals — `punchcard` / `pianoroll` / `scope`
      / `spectrum` / `markcss` draw to a per-editor canvas when the
      pattern calls them; nothing shown (canvas hidden) when it
      doesn't; playback unaffected either way.
- [ ] 2.4 `$:` / labelled multi-pattern documents evaluate (all labels
      play); per-label mute/solo without re-evaluation.
- [ ] 2.5 `setcps` / `setcpm` honoured for a standalone evaluation;
      a room's shared clock still wins where one applies.
- [ ] 2.6 Regression gate: `e2e/pattern-playback.spec.ts`,
      `e2e/multi-client.spec.ts`, `e2e/pattern-loading.spec.ts`,
      `nuxt typecheck`, `npm test` all green with the new engine, and
      `nuxt build` succeeds (bundles `@strudel/draw` etc.).
- [ ] 2.7 A short e2e or manual check that a `$:` document and a
      `.punchcard()` pattern both play + draw in a JAM track.

## 3. Docs

- [ ] 3.1 `content/docs/strudel/4.in-jam.md` → "Strudel in jaime":
      remove the "curated subset / leaves out" framing; keep a short
      honest note of real exceptions (Hydra, MIDI, tool-loaded sample
      banks).
- [ ] 3.2 `content/docs/strudel/3.sounds.md` — fix "the four basic
      waveforms" / "dirt-samples" lines now that the full map and all
      of Strudel's synths are available. `2.strudel.md` /
      `2.mini-notation.md` if they imply a subset.
- [ ] 3.3 `e2e/docs.spec.ts` still green with the edited pages.

## 4. Verification + deploy

- [ ] 4.1 `nuxt typecheck`, `npm test`, `playwright test` all green.
- [ ] 4.2 Manual against `wrangler dev`: a JAM room — a sample from the
      broader map plays; a `$:` two-label track plays with per-label
      mute; a `.pianoroll()` pattern animates; event highlight tracks
      the audio; every curated library pattern still previews clean.
- [ ] 4.3 `npm run deploy`; on `https://jaime.stream` confirm JAM still
      plays every curated pattern and the new features work live.

## 5. Spec sync + archive

- [ ] 5.1 `openspec validate add-strudel-parity --strict`.
- [ ] 5.2 Sync the `frontend-editor` delta into
      `openspec/specs/frontend-editor/spec.md`; archive the change.
- [ ] 5.3 `docs/04-roadmap/index.md` + `AGENTS.md` — record that the
      shared engine is at strudel.cc parity (Phase 3 fully closed;
      `add-composition-room` builds on this).
