# Backend architecture

## Overview

One Cloudflare Worker hosts both the Nuxt/Nitro server and a Durable Object
class. A room is one Durable Object instance, addressed by name
(`env.JAM_ROOM.idFromName(roomId)`), so the same room ID always resolves to
the same instance. WebSocket connections use the Hibernation API so idle
rooms don't accrue compute cost while still holding connections open.

```
Browser  --WebSocket-->  Worker (Nitro route)  --forwards-->  Durable Object (room)
```

A Nitro server route (e.g. `server/routes/room/[id].ts`) handles the
WebSocket upgrade and forwards the request to
`env.JAM_ROOM.get(id).fetch(request)`. The Durable Object itself never
parses or evaluates Strudel code — it only relays and validates ownership.

## Data the Durable Object holds

- `bpm` and `cycleStartTimestamp` — the shared transport clock
- `tracks: { [name]: { owner: string | null, code: string } }`
- Connected clients (via `ctx.getWebSockets()`), each tagged with a client id

## Message protocol

```typescript
type ClientMessage =
  | { type: "join"; name: string }
  | { type: "claim_track"; track: string }
  | { type: "pattern_update"; track: string; code: string } // only if owner
  | { type: "release_track"; track: string };

type ServerMessage =
  | { type: "room_state"; tracks: Record<string, {owner: string|null, code: string}>;
      bpm: number; cycleStart: number }
  | { type: "pattern_update"; track: string; code: string }
  | { type: "presence"; clients: {id: string, name: string, track: string|null}[] };
```

The DO's only real logic: on `pattern_update`, check the sender owns that
track, then rebroadcast to everyone else. Reject silently (or with an error
message) if they don't.

## Track ownership model

Each track can only be edited by whoever currently owns it. This
deliberately avoids CRDT/operational-transform complexity — there is never
concurrent writes to the same string, because only one person can hold a
track at a time. `claim_track` / `release_track` messages manage this.

## Transport clock (avoiding audio drift)

Naively broadcasting "start now" produces audible drift, since clients
receive the message at different wall-clock times. Instead:

1. On connect, each client does a quick round-trip ping to estimate its
   clock offset from the Durable Object.
2. The DO's `cycleStartTimestamp` is in the DO's own clock. Each client
   adjusts it by their measured offset and schedules Strudel's
   `scheduler.start()` for that corrected local time.
3. Every client ends up independently playing the same cycle in phase,
   without any audio crossing the wire.
4. Tempo changes: pick a new `cycleStartTimestamp` at the *next* bar
   boundary and broadcast it, so clients re-lock at a musical moment
   instead of snapping instantly.

## Persistence and reconnects

The Durable Object's built-in SQLite storage (`ctx.storage.sql`) holds
periodic snapshots of room state (track code, ownership). On reconnect, a
client just requests the current `room_state` — no replay log needed for
the MVP. Hibernation means the DO can go cold between bursts of activity
without dropping WebSocket connections; state is intact when a message
wakes it back up.

## Testing approach

- **Unit tests**: `@cloudflare/vitest-pool-workers` runs the actual Worker
  and Durable Object code inside `workerd` — instantiate the DO, simulate
  WebSocket messages, assert on broadcasts and ownership rejection.
- **Multi-client integration tests**: Playwright with multiple browser
  contexts joining the same room, claiming different tracks, asserting
  pattern updates propagate and that non-owners are rejected. CDP network
  throttling can simulate latency to validate the clock-offset correction
  under real jitter.
- **Load testing**: a script opening N concurrent WebSocket connections to
  one room (e.g. with `k6`) before building UI around presence at scale.
- **Deployed smoke tests**: run the same two-tab test against the real
  Cloudflare account (not just `wrangler dev` locally) starting from Phase 2,
  since hibernation and edge latency don't show up on localhost.
