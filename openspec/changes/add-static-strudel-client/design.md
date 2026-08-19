## Context

See proposal.md - Why. Reuses the stack decisions already made in
`docs/03-architecture-frontend.md` verbatim for this phase, scoped down
to one editor / one track: Nuxt 3 with `ssr: false` for the jam route,
CodeMirror 6, `@strudel/webaudio`, deployed via the Nitro `cloudflare`
preset.

## Goals / Non-Goals

**Goals:**
- Prove the Nuxt + CodeMirror + Strudel-webaudio + Cloudflare Workers
  stack works end-to-end, deployed to a real URL
- Shape `useJamSession()` now so Phase 2 (`add-room-relay`) only swaps
  its data source, not its interface

**Non-Goals:**
- Any WebSocket/Durable Object wiring (Phase 2)
- Track ownership or multiple simultaneous tracks (Phase 3)
- Persistence of any kind (Phase 5)

## Decisions

### Decision: Mount CodeMirror imperatively, not via a Vue component library
CodeMirror 6 is mounted imperatively in `onMounted` rather than relying
on a Vue-CodeMirror wrapper library. This keeps full control over editor
behavior once collaborative cursors/ownership indicators are added in
later phases.

**Revised during implementation:** rather than a hand-written
`EditorView.theme()`, `TrackEditor.vue` uses `@strudel/codemirror`'s
`initEditor()` helper (not its `StrudelMirror` class, which would couple
the editor to Strudel's own REPL/audio scheduling and break the
editor/audio-engine separation below). `initEditor()` bundles a
pattern-aware editor (JS-like syntax highlighting, Ctrl-Enter/Alt-Enter
to evaluate, Ctrl-./Alt-. to stop) plus a `strudelTheme` that already
exhaustively themes `.cm-content`/`.cm-gutters`/etc. with literal color
values (not CSS custom properties) — the same Tailwind-isolation problem
this decision originally called for, solved by Strudel's own theme
instead of ours. `docs/01-project-overview.md` names `@strudel/codemirror`
as the intended editor package, so this uses it as a real dependency
rather than only borrowing the module name.

One gap `initEditor()` doesn't cover: `.cm-editor` has an intrinsic
(content-sized) height by default, so it doesn't fill a flex/grid parent.
`TrackEditor.vue` adds a small scoped `<style>` block
(`:deep(.cm-editor) { height: 100% }`) for this — plain CSS targeting
CodeMirror's own class names, not Tailwind utility classes applied to
`.cm-*` nodes, so it doesn't violate the isolation rule below.

### Decision: `@strudel/webaudio` owns its own timing loop
The Strudel scheduler is not driven by Vue's render cycle — it runs its
own audio-accurate timing loop, with Vue only responsible for
start/stop/pattern-text plumbing. This avoids audio timing jitter tied
to browser paint/reactivity timing.

### Decision: Stub the state store now, not later
`useJamSession()` is created in this phase but holds only local editor
state (no `tracks`/`presence` from a WebSocket yet). This keeps the
Phase 2 diff small — the composable's shape doesn't change, only its
data source does. Alternative considered: skip the composable entirely
and add it in Phase 2 — rejected because it would force a component
API change (props/emits → composable) at the same time as the first
realtime integration, compounding risk.

### Decision: Deploy early
An early `wrangler deploy` to a real `*.workers.dev` URL happens in this
phase specifically to de-risk the Nitro `cloudflare` preset + Wrangler
config before any Durable Object complexity is added, per
`04-roadmap.md`.

## Risks / Trade-offs

- [Risk] Nitro `cloudflare` preset has edge cases with static asset
  hosting that only surface on a real deploy, not `wrangler dev` →
  Mitigation: task 4 explicitly deploys and manually verifies the live
  URL, not just localhost.
- [Risk] Building `useJamSession()` now, before its real shape is known
  from Phase 2's WebSocket protocol, risks guessing wrong → Mitigation:
  scope is deliberately minimal (local state only); if Phase 2 needs a
  different shape, the cost of changing it is small since nothing else
  depends on it yet.
- [Risk] `@kabelsalat/web` (a transitive `@strudel/core` dependency) has
  no `exports` map in its `package.json`, so Nitro's Rollup-based server
  build resolves its `main` field — a broken UMD bundle missing a static
  `SalatRepl` export — instead of the working `module` (`.mjs`) build.
  This only surfaces in `nuxt build` / `wrangler dev`, not `nuxt dev`. →
  Mitigation: `nuxt.config.ts` aliases `@kabelsalat/web` to its `.mjs`
  entry by absolute path. This is an upstream packaging bug, not
  something under our control — re-check on every `@strudel/*` upgrade
  in case it's fixed upstream and the alias can be dropped.
- [Risk] `@strudel/codemirror`'s bundled theme system
  (`initTheme`/`activateTheme`) force-toggles a global `dark` class on
  `<html>`, which would fight Nuxt UI's own color-mode system if called.
  → Mitigation: not called — `initEditor()`'s theme extension uses
  literal color values, not CSS custom properties, so it renders
  correctly without it. Revisit if a later phase adds a light/dark
  toggle and something depends on Strudel's CSS variables.
- [Risk] `@strudel/webaudio`'s `initAudioOnFirstClick()` resolves on the
  *next* `mousedown` after it's called — it does not check whether one
  already happened. Calling it lazily inside `evaluate()` (as first
  written) meant it always registered its listener after the click that
  focuses the editor, then hung waiting for a click that never came again
  once interaction went keyboard-only (Ctrl-Enter) — audio silently never
  started, no pattern played, and no error surfaced (an actual bug during
  implementation, caught by testing in a real browser, not just
  typecheck/build). → Mitigation: `audioEngine.ts` exports `primeAudio()`,
  called from `jam.vue`'s `onMounted`, so the listener is registered
  before the user's first click. `evaluate()` still awaits
  `initAudioOnFirstClick()` (idempotent) as a safety net.
- [Risk] `evalScope(import('@strudel/core'))` alone was not enough to
  actually play patterns, and the failure mode looked like success: a
  `note("c e g").s("sawtooth")` eval produced no error and the shared
  `AudioContext` reached `"running"`, but no sound was ever scheduled —
  because that "running" state only proves the audio pipeline unlocked,
  not that the pattern evaluated. Two real gaps existed, caught only by
  reading full browser console output (not just checking for an error
  alert or `AudioContext.state`) on both `nuxt dev` and the deployed URL:
  1. The transpiler statically rewrites string literals into `m("...",
     offset)` calls, so `@strudel/mini`'s exports (`m`) must be
     `evalScope`'d too — `miniAllStrings()` alone only sets the runtime
     string parser for a different code path (`Pattern.reify()`), it does
     not define `m` as a global.
  2. Even once patterns evaluate, `.s("sawtooth")` etc. need the sound
     registered — `registerSynthSounds()` (from `@strudel/webaudio`,
     re-exported from `superdough`) registers the built-in oscillator
     waveforms. Sample-bank sounds (drum hits) would need a separate
     `samples(url)` call — deliberately not added, to avoid a network
     dependency in Phase 1's manual test.
  → Mitigation: both calls added to `audioEngine.ts`'s bootstrap.
  Verified via full console capture showing `[eval] code updated` →
  `[cyclist] start`, not just the absence of a console error.
- [Risk] The deployed root URL (`https://jaime.marcoalmeida-dev-br.workers.dev/`,
  the URL a person actually visits/shares) 404'd — every verification
  pass had tested `/jam` directly, since that's the route `tasks.md` and
  `specs/frontend-editor/spec.md` name, without checking what happens at
  the bare deployed URL a real visitor lands on. Caught by the user, not
  by testing — a real miss: "does the deployed URL work" was answered
  narrowly ("does /jam work") instead of literally. → Mitigation: added
  `routeRules: { '/': { redirect: '/jam' } }`. Verified with the exact
  URL from the report: root redirects (307) to `/jam` (200), editor
  mounts, and a pattern evaluates and plays.
