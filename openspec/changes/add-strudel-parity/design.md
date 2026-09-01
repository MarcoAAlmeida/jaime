## Context

See `proposal.md` — Why. Split out of `add-composition-room`. Current
state:

- **Audio engine** (`app/lib/audioEngine.ts`): hand-wired — one
  `webaudioRepl` per track, `evalScope` of core/mini/tonal,
  `registerSynthSounds()`, a one-time
  `samples('github:tidalcycles/dirt-samples')`. No `$:` support, no
  visuals, no mini-notation highlight, no widgets. `evaluate()` /
  `evaluatePreview()` await the sample load only when needed. Per-track
  `beforeStart: waitForSynchronizedStart` (`app/lib/transportClock.ts`).
- **Editor** (`app/components/TrackEditor.vue`): calls
  `@strudel/codemirror`'s `initEditor()` (a sealed `EditorView`), then
  `StateEffect.appendConfig.of(...)` for the editable compartment;
  external code changes replace the whole doc.
- **`@strudel/codemirror` ships `StrudelMirror`** — the strudel.cc
  editor class: `initEditor()` + `repl()` + a `Drawer` +
  mini-location highlight wiring + slider/widget updates + a
  caller-supplied `prebake()` + `drawContext`.
- **`@strudel/draw`** (now a direct dep): `pianoroll`,
  `getPunchcardPainter`, `getDrawContext`, `spiral`, `pitchwheel`.
- JAM has N tracks; each is independently owned, evaluated, and played,
  each its own editor. The `pattern-playback` e2e evaluates every
  curated library pattern and fails on any pattern error.

## Goals / Non-Goals

**Goals:**

- One engine at strudel.cc parity — full sample map, `$:`, document
  `setcps`, mini-notation highlight, pattern-driven visuals — used by
  every editor in the app.
- JAM keeps working exactly as it does today apart from *gaining* these
  features: per-track ownership, transport-synced start, the
  auto-stop-on-edit behaviour, "every curated pattern plays".

**Non-Goals:**

- Hydra / WebGL video synthesis, MIDI/OSC, `samples('github:…')` from
  inside a tool.
- Collaborative editing, roles, room chat — `add-composition-room`.
- Per-keystroke auto-evaluation — evaluation stays explicit.

## Decisions

### 1. Build the engine on `StrudelMirror` + a jaime `prebake()`

Reaching parity by extending the bespoke engine means re-implementing
sample-map loading, `$:` handling, the `Drawer`, mini-location
highlighting, and widget/slider updates — all of which
`@strudel/codemirror`'s `StrudelMirror` already does. So the editor
factory wraps `StrudelMirror`:

- `prebake` = jaime's own function registering the full strudel.cc
  default sample map (see decision 2).
- `drawContext` = a `<canvas>` jaime mounts near the editor.
- `beforeStart` (via the underlying `repl` options) =
  `waitForSynchronizedStart`, unchanged.
- `solo: false` — jaime never wants one editor starting to stop the
  others (JAM tracks coexist; a library preview + a JAM track could
  coexist).

**JAM**: one `StrudelMirror` per track, sharing one lazy `prebake()`
promise and the singleton `AudioContext`. The per-track wrapper keeps
today's surface: `evaluate(track, code)` / `stop(track)` / last-error
tracking, external-code-apply without echo, the editable compartment.

**Alternative — keep the bespoke per-track `webaudioRepl` and bolt on
the parity pieces individually** (prebake, `@strudel/draw` painters,
`@strudel/codemirror` highlight, `$:` via the transpiler). Kept as the
fallback if N `StrudelMirror` proves too heavy or too entangled (the
`start-repl` solo custom event, the `initTheme()` dark-class hijack that
`TrackEditor.vue` already works around, bundle weight). The **group 1
spike** decides; the spec is unaffected either way.

### 2. `prebake()` — the strudel.cc default sample map

`app/lib/prebake.ts`: one function, memoised to a single promise,
registering the sample banks strudel.cc's REPL bakes — Dirt-Samples
(kept), plus the drum-machine, VCSL, piano, and EmuSP12-style sets.
Each `samples(...)` call in its own `try/catch` so one bank failing to
fetch degrades to "that sound is missing" rather than killing the rest.
Lazy — kicked off on first editor mount, awaited before a pattern
that needs samples, never blocking synth-only playback. The exact
bank URL list is settled while writing it (mirrors
`@strudel/repl`'s prebake) — an implementation detail, not a spec
question.

### 3. Visuals mount

Each editor gets a sibling `<canvas>`; `StrudelMirror`'s
`onDraw`/`Drawer` already drive `@strudel/draw`'s painters and
`@strudel/webaudio`'s `scope`/`spectrum` onto a draw context. jaime
provides the canvas and its layout (below the editor in JAM's track
card; the Composition Room arranges its own later). A pattern with no
visual call draws nothing and the canvas stays hidden.

### 4. Docs

`content/docs/strudel/4.in-jam.md` → "Strudel in jaime": drop the
"curated subset / leaves out" list; keep a short honest note of the
real remaining exceptions (Hydra, MIDI, tool-loaded sample banks).
Fix the "four basic waveforms" line in `3.sounds.md` and any
"dirt-samples only" phrasing now that the map is the full set.

## Risks / Trade-offs

- **JAM playback regression** → do the engine swap, then gate on
  `e2e/pattern-playback.spec.ts` ("every curated pattern plays"),
  `e2e/multi-client.spec.ts`, `e2e/pattern-loading.spec.ts`,
  `nuxt typecheck`, `npm test` before this change is considered done.
- **N `StrudelMirror` in JAM** — solo events, theme hijack, bundle
  weight → `solo: false`, the existing theme workaround, lazy-load;
  fallback in decision 1.
- **Sample-map bundle / network** — more banks fetched → lazy per
  decision 2; synth-only playback unaffected; a bank failure is
  non-fatal.
- **`@strudel/draw` / `StrudelMirror` under the Nitro client build** —
  unverified → part of the group 1 spike and the verification gate.

## Migration Plan

1. Group 1 spike: one `StrudelMirror` (`solo:false`) + `prebake()` in a
   throwaway route; confirm it runs under jaime's build and multiple
   instances coexist. Record N-`StrudelMirror`-vs-bespoke here.
2. Write `prebake.ts`; build the editor factory; move JAM tracks onto
   it.
3. Wire highlight, visuals, `$:`, `setcps`.
4. Green the JAM e2e + typecheck + vitest, then deploy and re-check
   live.
5. Rollback: the change reverts as a unit — it is a swap of one
   internal module plus a component, no data or protocol change.

## Open Questions

- N `StrudelMirror` vs. bespoke-repl-plus-parity for JAM — resolved by
  the group 1 spike; affects task detail, not the spec.
- The exact sample-bank URL set to mirror — settled while writing
  `prebake.ts`.
