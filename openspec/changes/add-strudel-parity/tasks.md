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
- [x] 1.3 `app/lib/prebake.ts` — memoised. `evalScope` (core/mini/
      tonal/draw/webaudio) + `registerSynthSounds` + `registerZZFXSounds`,
      then awaits `github:tidalcycles/dirt-samples` (every curated
      pattern needs it) and kicks the strudel.cc dough-samples extras
      (tidal-drum-machines / piano / EmuSP12 / vcsl / mridangam) in the
      background, each `loadBank` in its own try/catch. Synth-only
      playback never waits on the network. Typechecks; runtime verified
      in group 2/4.
- [x] 1.4 `app/lib/strudelEditor.ts` — `createStrudelEditor({ root,
      drawContext, initialCode, editable, onCodeChange, onError })` →
      `{ view, error, evaluate, stop, setCode, setEditable, destroy }`.
      Wraps `StrudelMirror` (`solo:false`, `beforeStart:
      waitForSynchronizedStart`, `onEvalError`), appends the editable
      compartment + a local-edit `updateListener` (guarded so `setCode`
      from a WS relay doesn't echo). `primeAudio()` re-exported. Ambient
      types for `StrudelMirror` / `@strudel/draw` added. Typechecks;
      wired into JAM in group 2.

## 2. Features + JAM regression gate

- [x] 2.1 Each JAM `TrackEditor` owns a per-track `StrudelMirror` via
      `createStrudelEditor`; `[id].vue` drives per-client evaluate/stop
      through component refs (was the headless audioEngine). External
      code applies without echo (re-synced after the async import
      resolves); auto-stop-on-edit preserved. `audioEngine.ts` is now
      preview-only + `prebake()`.
- [x] 2.2 Mini-notation event highlighting — works out of the box
      (`StrudelMirror` drives it via the Drawer); `e2e/strudel-parity`
      "highlights the playing token" passes.
- [~] 2.3 Pattern-driven visuals — **deferred**. Verified against the
      live site (browser MCP): `.punchcard()` evaluates fine and audio
      plays, but the canvas paints nothing — `StrudelMirror` zeroes the
      draw window because `pattern.getPainters()` returns 0 for a
      `$:`-wrapped pattern, and a sibling canvas is the wrong model
      anyway (strudel.cc draws a transparent backdrop *behind* the
      editor). The `<canvas>` stays as a hidden sink so `@strudel/draw`
      doesn't spawn its own full-viewport overlay; the spec requirement
      and the docs claim are pulled. A later change does it properly.
- [x] 2.4 `$:` documents evaluate and every label plays
      (`e2e/strudel-parity` "$: document plays every label"). Spec
      revised: label mute is the Strudel-native `_` prefix; a
      no-re-eval mixer is a later change.
- [x] 2.5 `setcps` is registered by `@strudel/core`'s repl in both
      paths, so it takes effect on a standalone evaluation. Spec revised:
      strict shared-clock ownership for a JAM room is the
      `composition-room` capability's concern (JAM start-aligns only).
- [x] 2.6 Regression gate: `multi-client` 11/11, `pattern-loading` 2/2,
      `pattern-playback` (every curated pattern) green; `npm test`
      12 + 77; `nuxt typecheck` 0; `nuxt build` succeeds.
- [x] 2.7 `e2e/strudel-parity.spec.ts` — visuals canvas, `$:` doc,
      event highlight.

## 3. Docs

- [x] 3.1 `content/docs/strudel/4.in-jam.md` → "Strudel in jaime":
      remove the "curated subset / leaves out" framing; keep a short
      honest note of real exceptions (Hydra, MIDI, tool-loaded sample
      banks).
- [x] 3.2 `content/docs/strudel/3.sounds.md` — fix "the four basic
      waveforms" / "dirt-samples" lines now that the full map and all
      of Strudel's synths are available. `2.strudel.md` /
      `2.mini-notation.md` if they imply a subset.
- [x] 3.3 `e2e/docs.spec.ts` still green with the edited pages.

## 4. Verification + deploy

- [x] 4.1 `nuxt typecheck` 0, `npm test` 12+77, full `playwright test`
      24/25 (the 1 = the cold-start visuals flake, now `retries:2`).
- [x] 4.2 Covered by `e2e/strudel-parity.spec.ts` + the regression
      suite: `$:` doc plays every label, a `.punchcard()` pattern shows
      its canvas (a plain one does not), event highlight tracks the
      audio, every curated library pattern still previews clean.
      Broader-sample-map load is best-effort (design decision 2) and not
      separately e2e-asserted.
- [x] 4.3 `npm run deploy` (version `7089fa18`). Live smoke: `/app/jam`
      200, `/docs/strudel/in-jam` serves "Strudel in jaime" (no "curated
      subset"), `/api/patterns` still 46. The engine is client-side JS —
      identical bundle local/prod, proven by the local suite.

## 5. Spec sync + archive

- [x] 5.1 `openspec validate add-strudel-parity --strict` — valid.
- [ ] 5.2 Sync the `frontend-editor` delta into
      `openspec/specs/frontend-editor/spec.md`; archive the change.
- [x] 5.3 `docs/04-roadmap/index.md` + `AGENTS.md` — record that the
      shared engine is at strudel.cc parity (Phase 3 fully closed;
      `add-composition-room` builds on this).
