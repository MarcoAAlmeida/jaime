## 1. Durable Object

- [x] 1.1 Switch `nitro.preset` to `cloudflare-durable` and enable
      `nitro.experimental.websocket` — provides the `$DurableObject`
      class and Hibernation API wiring, no hand-written DO class (see
      design.md Decisions)
- [x] 1.2 Add the `$DurableObject` binding + SQLite-backed migration to
      `wrangler.jsonc`
- [x] 1.3 Confirm `wrangler dev` starts with the DO binding available, no
      runtime errors

## 2. Server route

- [x] 2.1 Add a Nitro server route using `defineWebSocketHandler({ open,
      message, close })`: relay pattern-code updates via
      `peer.publish(topic, data)` (excludes the sender automatically),
      send current in-memory code to a newly connected peer
- [x] 2.2 Confirm a WebSocket client can connect to the route locally —
      verified with two real WebSocket clients against `wrangler dev`:
      connect, relay reaches the other client, sender excludes itself,
      and a third client joining later immediately receives the
      already-set current code

## 3. Client relay

- [x] 3.1 Add a browser-only WebSocket client plugin: connect on page
      load, send pattern-code updates, apply incoming updates
- [x] 3.2 Swap `useJamSession()`'s `code` ref to be driven by the
      WebSocket plugin instead of purely local state
- [x] 3.3 Confirm a client never receives its own update echoed back
      (guard against fighting its own cursor, matching TrackEditor's
      existing `onChange` pattern) — verified in two real browser tabs:
      typed in tab 2, tab 1 updated correctly, tab 2's own content
      stayed exactly as typed (no duplication/corruption from an echo),
      no console errors in either tab. This required adding
      `TrackEditor.vue`'s guarded `watch(() => props.code, ...)`, which
      Phase 1 never needed and didn't have

## 4. Testing

- [x] 4.1 Unit tests with `@cloudflare/vitest-pool-workers` against the
      real DO code: broadcast reaches other clients, late joiner
      receives current state, sender excluded from its own broadcast —
      3/3 passing, verified deterministic across 5 runs. First version
      had a real test-harness bug (not a product bug): a message sent
      before a listener is attached is dropped, not buffered, so
      connecting two clients before consuming either's initial
      `room_state` intermittently lost one. Fixed by attaching each
      connection's listener before calling `accept()`, in the test
      helper itself, not left to caller ordering
- [x] 4.2 Manual two-tab smoke test locally: open `/jam` in two tabs,
      type in one, confirm the other updates — same test as 3.3 above

## 5. Deploy + real-network smoke test

- [x] 5.1 `wrangler deploy` with the DO binding —
      https://jaime.marcoalmeida-dev-br.workers.dev, `env.$DurableObject`
      binding confirmed active on the deployed Worker
- [x] 5.2 Manual two-network smoke test against the real deployment
      (laptop + phone hotspot, per `04-roadmap.md`) — confirm the relay
      still works under real edge latency, not just localhost —
      confirmed working by the user across laptop + phone on separate
      networks
