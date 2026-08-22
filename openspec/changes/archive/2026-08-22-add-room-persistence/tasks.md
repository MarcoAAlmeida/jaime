## 1. Ambient types + storage handle plumbing

- [x] 1.1 Run `wrangler types`; commit the generated
      `worker-configuration.d.ts`; verify `npx nuxt typecheck` still
      passes — passing; confirmed `DurableObjectState`/`DurableObjectStorage`
      are declared in the generated runtime types. Not anticipated in
      design.md: Nitro's auto-generated server tsconfig doesn't pick up
      a root-level `.d.ts` by default (its `include` only covers
      `server/**/*`, `shared/**/*.d.ts`, and a couple of Nuxt-internal
      paths) — needed `nitro.typescript.tsConfig.include` in
      `nuxt.config.ts` to add it explicitly; confirmed in the generated
      `.nuxt/tsconfig.server.json`
- [x] 1.2 Add `server/utils/durableStorage.ts` with a module-level
      storage handle plus a setter and a getter (the getter throws if
      called before the setter — that should never happen given the
      hook always fires before any request is handled, per design.md)
- [x] 1.3 Add `server/plugins/durable-storage.ts` hooking
      `cloudflare:durable:init` to synchronously capture `state.storage`
      into that module — both typecheck cleanly against the ambient
      types from 1.1

## 2. Persist room state

- [x] 2.1 Define the persisted room shape (`tracks`, `bpm`,
      `cycleStartTimestamp` — no `presence`) and a `persistRoom()`
      helper that writes the room's current full in-memory state as one
      snapshot, keyed by room ID
- [x] 2.2 Make `getRoom()` async: return the cached room if present;
      otherwise single-flight load from storage (falling back to a
      fresh room if nothing is stored yet) via a
      `loading: Map<string, Promise<RoomState>>` alongside the existing
      `rooms` cache
- [x] 2.3 Update `open()`, `message()`, and `close()` to await the now-
      async `getRoom()`
- [x] 2.4 Every mutating handler (`claim_track`, `release_track`,
      `pattern_update`, `play_track`, `stop_track`, `set_tempo`) awaits
      `persistRoom()` before broadcasting, not after and not
      fire-and-forget — `releaseAndStop()` persists once (capturing both
      the ownership and playback change together, per the whole-snapshot
      decision) before either of its two broadcasts, preserving the
      original ownership-then-playback broadcast order

## 3. Testing

- [x] 3.1 Unit test: after a mutation, the room's storage entry (read
      directly via the storage API, not through the in-memory cache)
      matches the expected persisted shape — `persists a mutation to
      storage as a whole-room snapshot, excluding presence`, passing
- [x] 3.2 Unit test: the persisted shape never includes `presence` —
      covered by the same test as 3.1 (`expect(stored).not.toHaveProperty('presence')`)
- [x] 3.3 Verify `npx vitest run` still passes in full — no regressions
      from `getRoom()` becoming async — 21/21 passing
- [x] 3.4 Manual: claim a track and edit its pattern in a room, restart
      local `wrangler dev`, reconnect to the same room ID, confirm the
      claim/code/tempo survived — **upgraded beyond manual**: design.md's
      assumption that hibernation couldn't be tested automatically was
      wrong — `@cloudflare/vitest-pool-workers` exports
      `evictDurableObject()` for exactly this. New test
      `survives a Durable Object eviction: reconnecting after eviction
      sees the prior state, not a fresh room` genuinely tears down
      in-memory state and proves the rehydrate path, not a stand-in.
      Manual restart also performed against local `wrangler dev`: wrote
      `note("persisted!")` to track `a` in a room via a throwaway script,
      killed and restarted the dev server, reconnected — the pattern
      code, `bpm` (120), and `cycleStartTimestamp` all came back exactly
      as before the restart. (The reconnecting room_state showed track
      `a`'s owner as `null`, not the original client — expected, not a
      gap: the test script's own `ws.close()` released ownership through
      the normal close flow before the restart even happened, so `null`
      was already the persisted value by the time the server restarted.)
- [x] 3.5 Manual: after that same restart, confirm presence reflects
      only actually-reconnected clients, not stale entries carried over
      from before the restart — confirmed: the room_state received after
      restart listed only the newly-reconnecting client's ID, with
      nothing left over from the original (by-then-closed) connection

## 4. Deploy + verify

- [x] 4.1 `wrangler deploy` — https://jaime.marcoalmeida-dev-br.workers.dev,
      landing page verified returning 200
- [x] 4.2 Against the deployed instance: claim a track and edit its
      pattern in a room, redeploy again (forces a full restart),
      reconnect to the same room ID, confirm state survived — wrote
      `note("survived a redeploy")` to track `b`, redeployed (new
      Version ID confirms a genuine restart), reconnected: the pattern
      code, `bpm`, and a presence roster with no stale entries all came
      back correctly
