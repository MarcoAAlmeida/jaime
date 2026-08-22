## Why

Room state currently lives only in the Durable Object's in-memory JS state, which Cloudflare can evict at any time — hibernation during a quiet period, or a full cold start after total inactivity — silently losing every claimed track, written pattern, and tempo change the moment it happens, with no warning to anyone. Phase 5 of the roadmap (`docs/04-roadmap.md`) makes room state durable so it survives the Durable Object's own process lifecycle, not just individual client connections.

## What Changes

- Room state (each track's code/owner/`isPlaying`, `bpm`, `cycleStartTimestamp`) is persisted to the Durable Object's SQLite-backed storage on every mutation, and rehydrated the next time the object constructs (hibernation wake or cold start) instead of starting fresh and silently losing everything.
- Presence is deliberately **not** persisted — it's rebuilt from whichever WebSockets are actually still connected each time the object (re)constructs, since a stored presence list would go stale the instant a connection actually drops during the outage that caused the restart in the first place.
- `realtime-room`'s "Late Joiner Sees Current State" requirement is reworded to drop its "in-memory" qualifier — the current code a late joiner receives may now come from durable storage after a restart, not only from live memory, and the requirement shouldn't imply otherwise.

## Capabilities

### New Capabilities
- `room-persistence`: room state survives the Durable Object's own process restarting (hibernation wake or cold start), not just an individual client's own reconnect.

### Modified Capabilities
- `realtime-room`: the "Late Joiner Sees Current State" requirement's wording changes from "in-memory pattern code" to implementation-agnostic phrasing, since that code's source is no longer only live memory.

## Impact

- `server/routes/room.ts`: `getRoom()` becomes async, backed by the Durable Object's storage instead of a pure in-memory `Map`; every mutating handler (`claim_track`, `release_track`, `pattern_update`, `play_track`, `stop_track`, `set_tempo`) awaits it and writes the room's state through to storage on change.
- New Nitro server plugin hooking the `cloudflare:durable:init` lifecycle hook (documented in `nitropack`'s Cloudflare preset types) to capture the Durable Object's storage handle once per construction — see design.md for why this is the only way to reach it given how this project's `cloudflare-durable` preset is wired.
- No client-visible protocol changes: `room_state` on connect already carries everything a client needs. This phase only changes where that data survives between the Durable Object's own restarts, not what's sent over the wire.
