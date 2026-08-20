## Context

See proposal.md - Why. Builds on `docs/02-architecture-backend.md`'s
backend architecture, scoped down to just the room-relay slice (WebSocket
connect + broadcast) — ownership, clock sync, and persistence are that
doc's other concerns, each belonging to a later phase per
`04-roadmap.md`.

## Goals / Non-Goals

**Goals:**
- Prove the Durable Object + WebSocket Hibernation API pipeline end to
  end, including a real deployed smoke test — per `04-roadmap.md`, Phase
  2 is where testing against the actual Cloudflare account starts
  mattering, since hibernation and edge latency don't show up locally
- Keep `useJamSession()`'s shape stable — only its data source changes,
  per Phase 1's `design.md` decision

**Non-Goals:**
- Track ownership (`claim_track`/`release_track`) — Phase 3
- Transport clock (`cycleStartTimestamp`, tempo) — Phase 3
- Persistence across Durable Object cold starts — Phase 5
- Multiple/dynamic rooms — Phase 4
- Presence, display names — Phase 6

## Decisions

### Decision: One hardcoded room
Per `02-architecture-backend.md`, `idFromName(roomId)` always resolves to
the same Durable Object instance for the same string, so every client
landing on the same fixed string lands in the same room with no
room-selection UI — that arrives in Phase 4. In practice this is
dictated by the preset below (`idFromName("server")`, fixed), which
happens to be exactly this decision already made for us.

### Decision: Use Nitro's `cloudflare-durable` preset (crossws), not a
hand-rolled Durable Object class
`02-architecture-backend.md` sketches a hand-written DO class using the
raw Hibernation API (`ctx.acceptWebSocket`, `webSocketMessage`/
`webSocketClose` methods). Verified during implementation that Nitro
ships this already: the `cloudflare-durable` preset (extends
`cloudflare-module`, just swaps the entry file) auto-exports a
`$DurableObject` class wired to h3/crossws's WebSocket handling, so a
plain server route using `defineWebSocketHandler({ open, message,
close })` is all that's needed — no DO class code to write. Confirmed by
reading the preset source
(`nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs`) and
the crossws Cloudflare Durable Object adapter, not assumed from docs.

This preset already uses `ctx.acceptWebSocket()` internally (real
Hibernation API compliance), and its `peer.publish(topic, data)`
explicitly skips the sending connection
(`if (ws === this._internal.ws) continue`) — which is exactly the
Pattern Relay requirement's "does not echo back to the sender" rule,
for free, instead of us tracking sender identity by hand.

Two fixed conventions this preset dictates, not chosen by us: the
binding name must be `$DurableObject` (hardcoded in the preset's runtime
file, not a nitro.config option) and the single DO instance is always
`idFromName("server")` (also hardcoded) — which happens to match this
phase's "one hardcoded room" decision above exactly, but see Risks for
what this means for Phase 4.

Requires `nitro.experimental.websocket: true` in `nuxt.config.ts` — this
flag is what makes `import.meta._websocket` compile to `true` in the
preset's runtime file; without it the WebSocket upgrade path is
compiled out entirely.

### Decision: In-memory room state only, no persistence yet
The current pattern code lives in a module-level variable in the
WebSocket route file, not `ctx.storage` — there's only ever one DO
instance ("server"), so this behaves like DO-instance state in practice
for Phase 2's purposes. Satisfies "late joiner sees current state" while
the DO is warm, but state is lost on a cold start / hibernation wake,
since nothing is persisted yet (Phase 5).

### Decision: Provision the DO as SQLite-backed now, even though unused
`wrangler.jsonc`'s migration uses `new_sqlite_classes`, not the legacy
`new_classes`, even though this phase never touches `ctx.storage.sql`.
Cloudflare doesn't let a Durable Object class freely switch storage
backends after its first migration — starting SQLite-backed now avoids a
forced migration when Phase 5 actually adds persistence.

## Risks / Trade-offs

- [Risk] Nitro's `cloudflare-durable` preset hardcodes both the binding
  name (`$DurableObject`) and the instance name (`idFromName("server")`)
  in its own runtime file — not exposed as nitro.config options. That's
  a perfect fit for "one hardcoded room," but it means dynamic/multiple
  rooms (Phase 4) can't be layered onto this preset as configuration —
  Phase 4 will likely need to drop this preset for a hand-rolled DO
  route (closer to `02-architecture-backend.md`'s original sketch) or
  find another extension point. → Mitigation: none needed now: accepted
  cost of the much smaller, lower-risk Phase 2 implementation; revisit
  when Phase 4 is actually scoped, not before.
- [Risk] Confirmed via `node_modules/wrangler/config-schema.json` (not
  assumed): `durable_objects.bindings` needs `{ name, class_name }`, and
  top-level `migrations` needs `{ tag, new_sqlite_classes }`. Both
  written into `wrangler.jsonc` directly rather than relying on Wrangler
  to auto-generate them — Phase 1 already established that Nitro's
  `deployConfig` auto-generation is opt-in and off by default.
- [Risk] In-memory-only state means a cold start silently drops the
  room's current pattern code with no user-visible warning →
  Mitigation: accepted for Phase 2 per roadmap sequencing (persistence
  is explicitly Phase 5) — noted here so it isn't mistaken for a bug
  during this phase's manual/deployed testing.
- [Risk] `wrangler dev` locally doesn't exercise hibernation or real edge
  latency → Mitigation: `tasks.md` includes a two-network manual test
  (laptop + phone hotspot) against the real deployment, per
  `02-architecture-backend.md`'s testing approach, not just localhost.
- [Risk] A `WebSocket` message sent before a listener is attached is
  dropped, not buffered — the first version of the
  `@cloudflare/vitest-pool-workers` test suite connected two clients
  before consuming either one's initial `room_state`, and intermittently
  lost one, timing out. Not a bug in `server/routes/room.ts` — confirmed
  by two real browser tabs behaving correctly the whole time; purely a
  test-harness ordering bug. → Mitigation: the test helper now attaches
  each connection's message listener before calling `accept()`, so
  there's no such window; verified deterministic across 5 runs.

## Open Questions

(none — resolved during implementation: no Durable Object class file to
write; Nitro's `cloudflare-durable` preset provides it, see Decisions)
