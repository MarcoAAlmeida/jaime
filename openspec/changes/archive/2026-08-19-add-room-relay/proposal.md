## Why

Phase 1 proved the single-user stack (editor, audio, deploy loop) with zero
realtime code. The next source of complexity to isolate, per
`04-roadmap.md`, is the relay itself: one hardcoded Durable Object room,
proving that a message typed by one client shows up in another. Track
ownership and clock sync are deliberately deferred to Phase 3 so this
change stays small enough to de-risk the Durable Object + WebSocket
Hibernation API pipeline on its own.

## What Changes

- Add a Durable Object class hosting one hardcoded room (a single fixed
  room ID — no room creation/selection yet, that's Phase 4)
- Add a Nitro server route handling the WebSocket upgrade and forwarding
  to the Durable Object via `env.JAM_ROOM.get(id).fetch(request)`
- Add a browser-only WebSocket client plugin that connects on page load,
  sends the local user's pattern-code edits, and applies incoming updates
- Swap `useJamSession()`'s `code` state from local-only (Phase 1) to
  WebSocket-driven — its shape doesn't change, only where updates come
  from, per Phase 1's `design.md` decision to keep this diff small
- Relay logic: the Durable Object rebroadcasts a `pattern_update` message
  to every other connected client in the room — no ownership check yet,
  since there's still only one shared pattern (not per-track)

Out of scope for this change: track ownership (`claim_track`/
`release_track`), the shared transport clock (`cycleStartTimestamp`,
tempo), persistence/reconnect state, and multiple/dynamic rooms — all
explicitly later phases per `04-roadmap.md`.

## Capabilities

### New Capabilities
- `realtime-room`: WebSocket connection to a single hardcoded Durable
  Object room, and pattern-code relay between clients connected to it

### Modified Capabilities
(none — `frontend-editor`'s own requirements are unchanged; only where
`useJamSession()` gets its state from changes, which is an implementation
detail, not an externally observable behavior change)

## Impact

- New files: a Durable Object class (room relay), a Nitro WebSocket route,
  a browser-only WebSocket client plugin
- Modified files: `useJamSession.ts` (data source), `wrangler.jsonc` (DO
  binding + migration), `nuxt.config.ts` if the DO needs registering there
- New dev dependency: `@cloudflare/vitest-pool-workers`, per
  `02-architecture-backend.md`'s testing approach — runs the actual DO
  code inside `workerd`, not a mock
- Deploy target: per `04-roadmap.md`, Phase 2 onward is smoke-tested
  against the real Cloudflare deployment (not just `wrangler dev`), since
  edge latency and DO hibernation don't show up on localhost
