## Context

See proposal.md - Why. Builds on Phase 2/3's relay, ownership, and clock
(`server/routes/room.ts`, `app/plugins/websocket.client.ts`,
`shared/roomProtocol.ts`, `shared/tracks.ts`).

**A finding that shapes this whole design**: `nitropack`'s
`cloudflare-durable` preset — the thing that gives us a Durable Object
without a hand-written DO class, chosen deliberately in Phase 2 — always
addresses **one hardcoded Durable Object instance** for the entire
Worker:

```js
// node_modules/nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs
const DURABLE_INSTANCE = "server";
const getDurableStub = (env) => {
  const binding = env[DURABLE_BINDING];
  const id = binding.idFromName(DURABLE_INSTANCE);  // always "server"
  return binding.get(id);
};
```

There is no supported way, short of bypassing the preset entirely, to
get `idFromName(roomId)` per-room Durable Object instances while still
using this preset. Everything below is designed around that constraint,
not around the "one DO per room" mental model the proposal's first draft
assumed before this was checked.

## Goals / Non-Goals

**Goals:**
- Distinct rooms are isolated from each other: message routing and
  presence never leak across room IDs, even though they share one
  Durable Object instance under the hood
- Creating a room requires no server round trip; joining requires only
  a room ID or link
- Presence — who's connected to a room right now — visible to everyone
  in that room

**Non-Goals:**
- True per-room infrastructure isolation (separate DO instances,
  independent scaling per room) — out of scope; see Risks
- Room deletion, expiration UI, or capacity limits — a room simply stops
  existing in memory when nobody's connected and the Durable Object
  later evicts it, same as today's single room
- Persistence across cold starts/hibernation — still Phase 5, unchanged
  from Phase 2/3's accepted limitation
- Display names — still Phase 6; presence identifies connections, not
  people

## Decisions

### Decision: One Durable Object instance, many rooms partitioned in memory
Forced by the finding above. `server/routes/room.ts` changes its
module-level state from one flat `{ tracks, bpm, cycleStartTimestamp }`
to `Map<roomId, RoomState>`, creating a room's entry lazily on first
connection. Every place that currently reads/writes the flat state reads
the current connection's room entry instead, looked up once and reused
for that connection's lifetime (see next decision for how a connection
knows its room ID).

**Alternative considered**: true per-room Durable Object instances via
`idFromName(roomId)`. This turns out to be cheaper than it first looked:
crossws's `cloudflare-durable` adapter has a public `resolveDurableStub`
option built for exactly this, and using it wouldn't cost the
Hibernation API integration — that lives in the DO class's own methods,
untouched by which stub resolver reached it. The actual blocker is
narrower: **Nitro's preset never exposes that option** — it's hardcoded
in the generated runtime file with no config surface to override it.
Getting it wired through would mean forking that one preset file (small,
but now a piece of nitropack internals we own and must manually re-diff
on every upgrade) or dropping the preset entirely (the real
Phase-2-avoided-it cost). Rejected for now on that maintenance-cost
basis, not technical infeasibility — worth revisiting if this app's
scale, or a hard requirement for rooms to fail independently of each
other, ever justifies owning that fork.

### Decision: Room-scoped crossws topics instead of one global topic
Today every peer subscribes to the single topic `'room'`; broadcasts
publish to it. That already provides exactly the tool needed for
in-memory room isolation: subscribe each peer to `` `room:${roomId}` ``
instead, and scope every `publish`/`broadcastToAll`/`broadcastToOthers`
call to that same topic string. No new capability required — crossws
topics are just app-chosen strings; only the string changes from a
constant to a per-connection value.

### Decision: Room ID travels as a query parameter, read from `peer.request.url`
The room's URL is `/room/[id]` client-side (a real Nuxt route), but the
WebSocket itself still connects to the single Nitro route file
`server/routes/room.ts` (`/room`) — the crossws upgrade path in the
preset above doesn't thread dynamic route params through to the peer.
The client connects to `/room?id=<roomId>`; `open(peer)` reads it via
`new URL(peer.request.url).searchParams.get('id')` (`peer.request` is
part of crossws's public `Peer` API). A connection with no `id` (or an
empty one) is rejected before it's treated as joining any room.

### Decision: Room IDs are client-generated with `nanoid`
Creating a room must not require a server round trip (per proposal.md).
`nanoid`'s default alphabet/length (21 chars) is longer than needed for
this app's scale; using `nanoid(10)` keeps the ID short enough to sit
comfortably in a shared link while remaining collision-safe for a
casual-use room count. `nanoid` is already present as a transitive
dependency (verified in `package-lock.json`) but not declared — this
phase adds it to `package.json` directly rather than relying on that
phantom install, which could silently break on an unrelated dependency
bump.

### Decision: Presence identifies connections, not people
No display-name system exists yet (Phase 6). Presence reuses the
existing per-connection `peer.id` (already assigned in Phase 3 for
ownership) as its only identifier — a roster is a set of connection IDs
that changes on join/leave. The UI can render this as a count and/or a
short visual marker derived from the ID, but the protocol carries no
name, avatar, or other identity claim.

### Decision: Fixed 2-track generic roster, no instrument theming
`shared/tracks.ts`'s `TRACK_NAMES` shrinks from `['drums', 'bass',
'lead', 'pad']` to `['a', 'b']`, displayed in the UI as "Track A" /
"Track B" via a small label map rather than relying on raw
`text-transform: capitalize` (which would render the hyphenated form of
a more descriptive slug awkwardly). `DEFAULT_CODE`'s starter patterns
drop their instrument framing (no more "this one is drums") in favor of
two neutral, non-prescriptive starters — per the user's correction
during scoping: think two DJ decks, not two instrument roles: each
owner decides what to script.

## Risks / Trade-offs

- [Risk] Every room shares one Durable Object's single-threaded event
  loop and memory — a very large number of concurrent rooms, or one
  unusually heavy room, can affect every other room's latency, unlike
  true per-room DO instances which scale independently. →
  Mitigation: accepted for this app's actual scale (a personal/small-
  group tool, not a multi-tenant product); revisit only if this proves
  to be a real bottleneck in practice. A later migration to genuine
  per-room DO instances would require bypassing this Nitro preset (see
  the rejected alternative above) — a bigger change, deliberately not
  taken now. Measured, not just assumed: `scripts/room-load-check.mjs`
  opening 30 concurrent connections to one room against the deployed
  instance completed within 250-463ms (p50 ~256ms — real network
  latency dominates, not DO contention), with presence correctly
  reflecting every connection. Theoretical, confirmed not a real
  concern at this app's actual scale.
- [Risk] In-memory-only room state means a room that hibernates away
  during a quiet period loses its state exactly as the single room does
  today. → Mitigation: not new to this phase — same accepted limitation
  Phase 2/3 already carries forward to Phase 5 (persistence).
- [Risk] Reducing the roster to 2 generic tracks and rewording starter
  content changes already-shipped behavior other than rooms themselves.
  → Mitigation: deliberate, requested during scoping, not scope creep;
  called out as **BREAKING** in the proposal.
