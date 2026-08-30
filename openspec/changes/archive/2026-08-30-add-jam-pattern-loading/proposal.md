## Why

The Pattern library (Phase 2a) is a dead end: you can browse, filter,
preview, and copy a pattern's code, but the only way to actually *use*
one in a tool is to paste it by hand. And even if you paste it into
JAM, most curated patterns won't sound right — JAM's audio engine only
registers the built-in synth waveforms, so anything using a named
sample (`s("bd")`, `s("amen")`, …) is silent.

This change closes that loop: a pattern goes straight from the library
into a JAM track, and JAM can play what the library contains. It merges
the "invoke a pattern into JAM" piece of roadmap Phase 4 with the
sample-playback piece of Phase 3, scoped to what the library needs
rather than a total feature audit.

## What Changes

- **JAM's audio engine loads a default sample bank.** `bootstrap()`
  (shared by JAM tracks and library preview) loads
  `github:tidalcycles/dirt-samples` — the same bank strudel.cc uses and
  that preview already loads — once, on first use. Named-sample
  patterns (`s("bd sd hh")`, breakbeats, chops) now produce sound in a
  JAM track. This deliberately reverses the earlier "no network
  dependency in JAM" stance (the `DEFAULT_CODE` comment in
  `shared/tracks.ts`).
- **Confirm the curated seed set plays in JAM.** Every pattern in
  `migrations/patterns/0002_seed_patterns.sql` must evaluate and play on
  a JAM track — the practical definition of "parity" for this change.
  `.scale()` / `.voicing()` already work (the `@strudel/tonal` fix);
  fill any remaining gap the seed set exposes.
- **"Load into JAM" from the library.** Each pattern in `/app/patterns`
  gains a "Load into JAM" action. It opens a **new** JAM room with the
  pattern as the code of **track A**, claimed for the loader, and drops
  them into that room with an invite link ready — the "start from this
  pattern" flow. Loading into an already-open room, or picking an
  existing room, is out of scope (a later addition).
- The invite link for such a room is a normal room link — a second
  person joining does not re-trigger the load; the seed happens once,
  client-side, for the person who clicked.

## Capabilities

### New Capabilities
*(none — this extends existing capabilities)*

### Modified Capabilities
- `frontend-editor`: add a requirement that a default sample bank is
  available to JAM playback, so patterns referencing named samples
  produce sound (today only synth waveforms are registered).
- `pattern-library`: add a requirement that a pattern can be loaded
  from the library into a tool — for now, into a new JAM room as the
  loader's track code.
- `room-lifecycle`: add a requirement that a room can be opened with an
  initial pattern that becomes the joining user's track code once they
  have claimed a track, without affecting anyone else who later joins
  that room.

## Impact

- **Changed code:** `app/lib/audioEngine.ts` (`bootstrap()` loads the
  sample bank; `evaluatePreview`'s separate sample load becomes
  redundant); `app/pages/app/patterns.vue` (the "Load into JAM"
  action); `app/pages/app/jam/room/[id].vue` +
  `app/composables/useJamSession.ts` / `app/plugins/websocket.client.ts`
  (apply an initial pattern once track A is claimed); possibly
  `app/pages/app/jam/index.vue`.
- **New dependency risk:** JAM sessions now fetch the sample-bank
  manifest + samples on first playback (previously offline-capable).
- **Specs:** `frontend-editor`, `pattern-library`, `room-lifecycle`
  each gain one requirement. No new capability files.
- **Not touched:** the realtime protocol's message shapes (load reuses
  the existing claim + pattern-update path), the pattern-library API,
  `User` / identity, Composition Room, `@nuxt/content`.
