# Roadmap

Each phase isolates one new source of complexity and is deployed to the real
Cloudflare account (not just tested locally) starting from Phase 2, since
edge latency and Durable Object hibernation behave differently than
`wrangler dev` on localhost.

## Phase 1 — Static client

A single-user Strudel client (editor + playback), hosted as static assets on
Cloudflare Workers. No realtime, no Durable Object yet.

**Test**: `wrangler dev` locally, then an early `wrangler deploy` to a real
`*.workers.dev` URL — get comfortable with the deploy loop before any state
enters the picture.

## Phase 2 — Single room relay

One hardcoded Durable Object room. Clients connect, and a message typed by
one client shows up in another. No track ownership rules yet, no clock sync
— just proving the relay works.

**Test**:
- Unit tests with `@cloudflare/vitest-pool-workers` against the real DO code.
- Manual two-tab smoke test locally, then the same test against the real
  Cloudflare deployment from two different networks (laptop + phone
  hotspot) to catch latency/hibernation surprises early.

## Phase 3 — Track ownership + clock sync

Introduces `claim_track` / `release_track`, and the shared transport clock
(round-trip offset correction, `cycleStartTimestamp`).

**Test**:
- Playwright with multiple browser contexts: join a room, claim different
  tracks, assert updates propagate and non-owners are rejected.
- Clock drift assertion: expose the computed local playback offset for the
  test to read from each context, assert they're within tolerance (e.g.
  <20ms) after correction.
- CDP network throttling per context to validate the offset correction
  holds up under real jitter, not just near-zero localhost latency.

## Phase 4 — Multi-room + presence

Rooms become dynamic (create/join by ID), and a presence list shows who's
connected and which track they hold.

**Test**:
- Extend the Playwright suite: two separate rooms in one test run, confirm
  a client in room A never receives room B's messages.
- Basic load test (e.g. `k6`) opening N concurrent WebSocket connections to
  one room to see how presence broadcast scales before building UI around it.

## Phase 5 — Persistence + reconnect

Durable Object SQLite snapshots of room state; clients reconnecting receive
the current `room_state`.

**Test**: kill a client mid-session (close tab), reopen, assert correct
state is received. Deliberately trigger hibernation (leave a room idle past
the hibernation window) and confirm state survives the wake-up.

## Phase 6 — Identity + polish

Display names, transport bar, room join screen, custom domain. Mostly
manual/UX testing at this point; no need for full user accounts to start —
a session display name is enough.

---

**Not scoped yet, possible future phases**: AI-assisted composition
(text-to-music via an externally hosted model, proxied through AI Gateway),
session recording/export, saved pattern library with similarity search
(Vectorize).
