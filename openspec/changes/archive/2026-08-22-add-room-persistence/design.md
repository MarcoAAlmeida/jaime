## Context

See proposal.md - Why. Room state currently lives entirely in
`server/routes/room.ts`'s module-level `rooms: Map<string, RoomState>`
(introduced in Phase 4) — nothing persists it, so it's gone the moment
the Durable Object's JS state is evicted.

**Two things worth checking before designing this, same approach as
Phase 4's DO-addressing investigation:**

1. **Reaching the storage handle at all.** Nitro's `cloudflare-durable`
   preset auto-generates the `$DurableObject` class; route handlers in
   `server/routes/*.ts` never see the Durable Object instance or its
   `ctx` directly — there's no `this.ctx.storage` available anywhere in
   our own code today. But the preset does call a documented Nitro hook
   once per construction:
   ```js
   // node_modules/nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs
   state.waitUntil(
     nitroApp.hooks.callHook("cloudflare:durable:init", this, { state, env })
   )
   ```
   typed in `nitropack/dist/presets/cloudflare/types.d.ts`:
   ```ts
   "cloudflare:durable:init": (durable: DurableObject, _: {
     state: DurableObjectState
     env: unknown
   }) => void
   ```
   A real, typed extension point — not an internal hack — that a Nitro
   plugin can hook to capture `state.storage`.

2. **Ambient Cloudflare Workers types.** Neither `@cloudflare/workers-types`
   nor a generated `worker-configuration.d.ts` exists in this project
   yet (verified: no matches for `DurableObjectStorage` outside
   `wrangler`'s own internal templates and `@cloudflare/vitest-pool-workers`'s
   test-scoped types). Something needs to provide `DurableObjectState`/
   `DurableObjectStorage` typing to our own server code for the first
   time — this phase is the first to touch the Workers runtime API
   directly rather than through crossws/h3's abstractions.

## Goals / Non-Goals

**Goals:**
- A room's track code, ownership, playback state, and tempo survive the
  Durable Object's own restart (hibernation wake or cold start)
- Presence always reflects only clients actually connected after a
  restart — never restored stale from before it
- No client-visible protocol change

**Non-Goals:**
- Persisting presence itself (see Decisions)
- Any migration/versioning strategy for the persisted shape — a single
  deployed app with no existing production data to migrate; revisit if
  the shape ever needs to change under real stored data
- Expiration or cleanup of persisted state for abandoned rooms — noted
  as a Risk, not solved here
- Multi-region or cross-instance replication — out of scope; still the
  single shared Durable Object instance established in Phase 4

## Decisions

### Decision: Capture the storage handle via the `cloudflare:durable:init` hook
A new `server/plugins/durable-storage.ts` (Nitro's standard
auto-loaded plugin location) hooks `cloudflare:durable:init` and stashes
`state.storage` into a module-level variable (`server/utils/durableStorage.ts`,
also auto-imported by Nitro convention) that `server/routes/room.ts` reads
from. The hook handler does this **synchronously** — no `await` before
the assignment — because `state.waitUntil(nitroApp.hooks.callHook(...))`
only keeps the isolate alive for the hook's promise; it doesn't block
the constructor or delay the next incoming event. Since JS runs the
synchronous portion of a call to completion before yielding, a
synchronous capture is guaranteed to finish before any subsequent
`fetch`/`webSocketMessage` can run — an async capture wouldn't have that
guarantee.

### Decision: Generate ambient types via `wrangler types`, not `@cloudflare/workers-types`
`wrangler types` (confirmed available in the installed wrangler version)
generates a `worker-configuration.d.ts` scoped to this project's actual
`wrangler.jsonc` bindings (`Env` with `$DurableObject`, `ASSETS`, etc.)
plus the runtime ambient types (`DurableObjectState`, `DurableObjectStorage`,
...) — the current Cloudflare-recommended approach, and more precise
than installing the generic `@cloudflare/workers-types` package. The
generated file is committed (not regenerated on every install); it only
needs regenerating by hand if `wrangler.jsonc`'s bindings change.

### Decision: Whole-room snapshot writes, not incremental persistence
Every mutation (`claim_track`, `release_track`, `pattern_update`,
`play_track`, `stop_track`, `set_tempo`) writes the room's *entire*
current in-memory state as one `storage.put()`, not a per-field diff.
This isn't just simplicity for its own sake: Durable Objects can
interleave different messages' async work across `await` points, so two
mutations to the same room can genuinely overlap (handler A mutates
in-memory state, then awaits its own persist; handler B for the same
room runs during that await, sees A's change already applied in-memory
since that part was synchronous, and then persists too). Because each
persist call always serializes whatever the in-memory object currently
holds — not a copy captured before the await — a later-completing write
still carries every change applied before it ran, regardless of which
`storage.put()` call actually finishes last. Incremental/partial writes
would not have this self-healing property and would need real
transactional ordering to stay correct.

### Decision: Persist before broadcasting, not fire-and-forget
Each mutating handler `await`s its `storage.put()` before publishing the
broadcast. This guarantees that if the Durable Object restarts
immediately after a mutation, it never loses a change other clients
already saw over the wire — the alternative (broadcast immediately,
persist in the background) could let a client observe a change that
then silently reverts after a restart.

### Decision: Presence is never persisted — rebuilt from live connections
Restated from proposal.md with the implementation consequence: this
needs no special "restore presence" logic at all. A room loaded fresh
from storage simply starts with an empty in-memory `presence: Set()`,
which then fills the exact same way it always has — via `open()`/`close()`
on whatever connections actually exist now. Persisting presence and then
having to reconcile it against reality would be strictly more code for
a worse guarantee.

### Decision: Single-flight loading per room to avoid a duplicate-read race
`getRoom(roomId)` now needs to be async (storage reads are async), which
opens a window where two messages for the same *not-yet-cached* room
(e.g. two clients' `open()` calls arriving close together right after a
restart) could both see a cache miss and both issue their own
`storage.get()`. A `loading: Map<string, Promise<RoomState>>` alongside
the existing `rooms` cache ensures concurrent callers for the same
uncached room converge on one in-flight load instead of racing to
populate the cache with two independently-constructed objects.

## Risks / Trade-offs

- [Risk] Persisted rooms accumulate in storage forever with no
  expiration — an abandoned room's state sits there indefinitely. →
  Mitigation: accepted for this app's scale (a personal/small-group
  tool); a cleanup mechanism (a storage-list sweep, or a Durable Object
  alarm) is a reasonable future addition, not needed now.
- [Risk] Adds an `await`ed storage round trip to every mutating message
  before its broadcast, on top of Phase 4's existing per-room
  contention. → Mitigation: Cloudflare Durable Object storage writes are
  same-region and typically fast; accepted for the durability guarantee;
  revisit if this proves noticeable in practice (the load-check script
  from Phase 4, `scripts/room-load-check.mjs`, can be extended if needed).
- [Risk, resolved better than expected] Assumed genuinely triggering
  hibernation on demand couldn't be forced reliably for an automated
  test. Wrong: `@cloudflare/vitest-pool-workers` exports
  `evictDurableObject(stub)` specifically for this — it tears down a
  Durable Object's in-memory state (hibernating its WebSockets by
  default) while preserving durable storage, exactly the scenario this
  phase needs to prove. `test/room.test.ts`'s `persistence` suite uses it
  directly: claim a track, write a pattern, evict, reconnect, assert the
  prior state comes back — not a stand-in, the actual code path. A full
  redeploy or `wrangler dev` restart remains a good real-environment
  sanity check (tasks.md 3.4/4.2), but the eviction test is the real
  proof, and it runs in every test suite invocation, not just when
  someone remembers to check by hand.
- [Risk] The committed `worker-configuration.d.ts` goes stale if
  `wrangler.jsonc`'s bindings change without regenerating it. →
  Mitigation: the same trade-off every Workers project taking this
  approach accepts; regeneration is a single `wrangler types` command,
  noted in tasks.md.
