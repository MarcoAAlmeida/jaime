## 1. Sample bank in the shared audio engine

- [x] 1.1 `app/lib/audioEngine.ts`: load
      `samples('github:tidalcycles/dirt-samples')` once from
      `bootstrap()`, tracked by a module-level promise, kicked off but
      not awaited inside `ensureReady()` (evalScope +
      `registerSynthSounds()` stay fast)
- [x] 1.2 `evaluate(track, code)` and `evaluatePreview(code)` await the
      samples promise *after* `ensureReady()`; a rejected samples load
      is logged, not thrown (sample patterns then error like an unknown
      sound)
- [x] 1.3 Delete `ensurePreviewSamples` / the preview-only samples load
      now that it's in `bootstrap()`
- [x] 1.4 Update the `DEFAULT_CODE` comment in `shared/tracks.ts`
      ("no sample bank yet" is no longer true) and the audio-engine
      comments about avoiding a network dependency

## 2. Curated seed set plays in JAM

- [x] 2.1 `e2e/pattern-playback.spec.ts` — drives the library preview
      path for every seeded pattern (titles from `/api/patterns`) and
      asserts no "Pattern error". Runs with
      `--autoplay-policy=no-user-gesture-required`.
- [x] 2.2 Nothing to fix — all 20 seed patterns evaluate cleanly once
      the shared `bootstrap()` loads the sample bank (the `@strudel/tonal`
      fix already covered `.scale()` / `.voicing()`). No seed swaps.

## 3. Room page applies a loaded pattern

- [x] 3.1 `app/pages/app/jam/room/[id].vue`: `watch([clientId, wantsLoad])`
      — once connected, `$fetch('/api/patterns/<id>')`; if track `a` is
      unowned `sendClaimTrack('a')`; a second `watch(isOwnedByMe('a'))`
      calls `onCodeUpdate('a', code)` once ownership lands. `loadPhase`
      ref guards against re-entry.
- [x] 3.2 `applyLoadedCode()` ends with `router.replace({ path, query: {} })`.
- [x] 3.3 Track `a` owned by someone else, or the fetch throws →
      `loadPhase = 'skipped'`, a dismissible `data-testid="load-notice"`
      `UAlert`, track left on its default.
- [x] 3.4 Guard: `loadPhase` leaves `idle` on first run and the
      "track A taken" branch covers the realistic stale-link case (the
      opener shares the post-`replace` clean link). Exercised end-to-end
      by 5.2.

## 4. "Load into JAM" in the library

- [x] 4.1 `app/pages/app/patterns.vue`: `loadIntoJam(pattern)` →
      `navigateTo('/app/jam/room/' + nanoid(10) + '?load=' + encoded id)`.
- [x] 4.2 First in the expanded-row button group, `color="primary"`,
      `data-testid="load-into-jam"`; Preview/Copy demoted to neutral
      outline.

## 5. Verification + deploy

- [x] 5.1 `nuxt typecheck` clean; `vitest run` 48/48; `playwright test`
      14/14 (11 existing + `pattern-loading` ×2 + `pattern-playback`).
- [x] 5.2 `e2e/pattern-loading.spec.ts` — 2 tests: load "Four on the
      floor" → track A seeded + claimed + `?load` stripped, Bob joining
      the clean link sees A's code but keeps his default track B;
      and a stale `?load` on a room with track A taken shows the notice
      and doesn't overwrite.
- [x] 5.3 Verified against `wrangler dev`: "Amen slice"
      (`s("amen").chop(8)…`) loaded into JAM → auto-claimed, Play →
      "Playing" badge, no pattern error (sample bank works in a JAM
      track). Every seed pattern plays (5.2 playback test). "Load into
      JAM" is the lead action in the library row. Later-joiner / clean
      invite link covered by 5.2.
- [ ] 5.4 `npm run deploy` (user runs — `wrangler deploy` is
      sandbox-blocked); verify on `https://jaime.stream`: load a
      sample-based curated pattern into JAM and hear it
