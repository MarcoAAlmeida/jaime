## Context

See proposal.md — Why. State that shapes the approach:

- `app/lib/audioEngine.ts` has one `bootstrap()` (evalScopes core / mini
  / tonal, `registerSynthSounds()`) run once via `ensureReady()`, shared
  by JAM's per-track repls and the library's preview repl. Preview
  additionally loads `github:tidalcycles/dirt-samples` in
  `evaluatePreview` (`ensurePreviewSamples`). JAM tracks get no samples.
- JAM has **two** tracks (`a`, `b` — `shared/tracks.ts`). A room is
  created lazily: `createRoom()` just does
  `navigateTo('/app/jam/room/<nanoid>')`; the server materialises the
  room from `DEFAULT_CODE` when the first WebSocket connects. The client
  claims a track (`sendClaimTrack`) then edits (`sendPatternUpdate`),
  both over the existing protocol — no new message types needed.
- The room page (`/app/jam/room/[id]`, `ssr: false`) gates on a display
  name first, then connects the WebSocket, then renders tracks.
- `/app/patterns` already fetches from `/api/patterns` and has the
  pattern code + id in hand per row.

## Goals / Non-Goals

**Goals:**
- Named-sample patterns play on a JAM track.
- The whole curated seed set plays on a JAM track with no pattern error.
- One click in the library → a new room with the pattern on the
  loader's track A, invite-ready.
- The realtime protocol is unchanged.

**Non-Goals:**
- Loading into an already-open room, or choosing an existing room.
- A pattern picker *inside* a room.
- Loading onto track B or letting the user choose the track.
- Total strudel.cc feature parity — only what the seed set needs.
- Self-hosting samples (R2). The bank is fetched from its upstream repo.

## Decisions

### 1. Load the sample bank in the shared `bootstrap()`, not per-repl

Move the `samples('github:tidalcycles/dirt-samples')` call out of
`evaluatePreview` and into `bootstrap()`, kicked off (not awaited)
alongside `registerSynthSounds()` and tracked by a module-level
promise. `evaluate()` / `evaluatePreview()` await that promise only
when they actually need it — but since sample registration is global to
Strudel, doing it once in bootstrap is simplest and both paths benefit.
Preview's `ensurePreviewSamples` is deleted.

*Alternative considered:* keep it preview-only and add a parallel load
in the JAM path — rejected as duplicate logic for a global effect.

### 2. Don't block playback on the sample fetch

`bootstrap()` must still resolve quickly so the editor and synth-only
patterns aren't held hostage by a slow sample-manifest fetch. Structure:
`ensureReady()` awaits evalScope + `registerSynthSounds()` (fast);
`samples(...)` runs in the background with its own promise. `evaluate()`
awaits the samples promise *after* `ensureReady()` — so a synth-only
first evaluation can proceed, and a sample pattern waits only as long as
the fetch actually takes. A failed sample fetch is logged, not fatal;
sample patterns then error the same way an unknown sound already does.

### 3. "Parity" = the seed set plays; audit driven by failures

Not a function-by-function review. Run every seed pattern through a JAM
track (a test that evaluates each `code` against the engine) and fix
what fails. `.scale()` / `.voicing()` are already handled. Expected
remaining gap: just the sample bank. If a seed pattern needs a
feature that's genuinely out of scope to add, swap that seed rather
than expand scope — and note it.

### 4. "Load into JAM" carries the pattern id in the URL, applied once

`/app/patterns` "Load into JAM" → `navigateTo('/app/jam/room/<nanoid>?load=<patternId>')`.

The room page, after the WebSocket is connected and the local client
has a `clientId`:
- if `route.query.load` is set and this client has not already applied
  a load this session (a `ref` guard),
- claim track `a` if it is unowned (skip if already owned by someone
  else — surface a small notice, don't fight for it),
- once track `a` is owned by this client, `sendPatternUpdate('a', code)`
  with the pattern's `code`,
- then `router.replace` to the same path without `?load`, so the
  address bar and any copied invite link are clean.

The `code` is fetched from `/api/patterns/<id>` on the room page (not
passed in the URL) — keeps the URL short, keeps the pattern canonical,
and the fetch is cheap. If the fetch fails, show a notice and leave the
track on its default code.

*Alternative considered:* pass the raw code in the URL / in
`history.state`. URL: long, ugly in a shared link before it's stripped.
`history.state`: lost on refresh and awkward with `navigateTo`.
Fetch-by-id is the cleanest.

*Alternative considered:* a server-side "seed this room with pattern X"
message. Rejected — it would add a protocol message and a server code
path for something the client can do with the existing claim +
pattern-update messages.

### 5. Track A only, claimed for the loader

The loader lands on `a`. If `a` is already claimed by someone else
(possible only if they somehow share the fresh room id first — vanishing
edge case for a `nanoid` room), the load is skipped with a notice. No
UI to pick a track; that is a non-goal.

## Risks / Trade-offs

- **JAM now depends on a network fetch for samples.** → Non-blocking
  (decision 2); synth patterns and the editor are unaffected; a failed
  fetch degrades to "sample patterns error", not "JAM broken". The
  bank is cached by the browser after first load.
- **The sample-bank repo could move or rate-limit.** → Same bank
  strudel.cc itself uses; acceptable for now. R2 self-hosting is a
  noted future option, not this change.
- **`?load=` visible briefly before `router.replace`.** → Only the
  loader ever sees it, for a moment; invite links copied after the
  replace are clean; the "later joiner not re-seeded" scenario is
  covered by the once-per-session guard even if a stale `?load=` URL is
  shared.
- **Bundle weight.** No new deps — `samples` is already imported from
  `@strudel/webaudio`. Only the runtime sample fetch is new.

## Migration Plan

1. Sample bank in `bootstrap()`; delete `ensurePreviewSamples`; keep
   `evaluate`/`evaluatePreview` non-blocking on it.
2. A test that runs every seed pattern's `code` through the engine;
   fix/swap failures.
3. Room page: apply `?load=<id>` once — fetch code, claim `a`, seed,
   `router.replace`.
4. Library: "Load into JAM" action per row.
5. e2e: library → Load into JAM → land in a room with the pattern on
   track A; a second client joining that room is not seeded.
6. Single `npm run deploy`; verify on `jaime.stream` (load a
   sample-based pattern, hear it).

**Rollback:** additive — revert the commit, redeploy. No schema or data
changes. The library falls back to browse/preview/copy only.
