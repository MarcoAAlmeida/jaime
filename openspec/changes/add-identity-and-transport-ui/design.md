## Context

See proposal.md - Why. Builds on the existing protocol
(`shared/roomProtocol.ts`), room state (`server/routes/room.ts`), and
the transport clock (`shared/transportMath.ts`,
`app/lib/transportClock.ts`) — `set_tempo`/`tempo_update` have existed
since Phase 3 with no UI ever calling `sendSetTempo` from
`app/plugins/websocket.client.ts`.

`docs/03-architecture-frontend.md` mentions "a presence list, a
transport bar" as expected UI, with no further detail — this phase is
where both get defined concretely for the first time.

## Goals / Non-Goals

**Goals:**
- A user sets a display name for their session (no account) before
  entering any room
- Presence and track ownership show that name, not an opaque connection
  ID
- Every client can see and change a room's tempo

**Non-Goals:**
- Accounts, authentication, or identity persisting across sessions
- Custom domain — explicitly dropped from this phase, per direction
- Restricting who can change tempo — `set_tempo`'s handler already
  accepts it from any connected client with no ownership check; this
  phase only adds the missing UI, not a new permission model

## Decisions

### Decision: Display name travels the same way room ID does — a query parameter
Consistent with Phase 4/5's "Room ID travels as a query parameter"
decision: the client connects to `` /room?id=<roomId>&name=<name> ``;
`open(peer)` reads both via `new URL(peer.request.url).searchParams`. A
connection with a missing or empty (after trimming) `name` is rejected
the same way a missing room ID already is — the join screen is supposed
to guarantee a name always exists by the time a connection is attempted,
so treating an absent one as a protocol violation (not silently
defaulting to something like "Anonymous") keeps the server the actual
enforcement point, matching how ownership enforcement already works
server-side rather than trusting client UI alone.

### Decision: Presence is the single source of truth for names — ownership stays an ID
`TrackState.owner` stays exactly what it already is: a connection ID or
`null`. It does **not** grow a name field. Instead, `room_state`'s
`presence` and the `presence_update` message carry `{ clientId, name }`
pairs, and the client resolves "whose track is this" by looking up the
owner's ID in the presence roster it already holds. This avoids storing
the same name in two places that could drift (e.g. if a client's name
changed mid-session — not supported yet, but this design doesn't
preclude it later) and needs zero changes to `ownership_update`,
`playback_update`, or `TrackState` itself.

**Alternative considered**: put `{ id, name }` directly on `TrackState.owner`.
Rejected — duplicates data already available via presence, and would
need `ownership_update` to also carry a name for consistency, growing
the protocol surface for no behavior presence doesn't already cover.

### Decision: `RoomState.presence` becomes `Map<clientId, name>`, not persisted
Was `Set<string>`. Names are looked up from live connections, exactly
like the connection IDs already are — this needs no interaction with
Phase 5's persistence work, since presence was already deliberately
excluded from what gets written to storage (a restored roster would go
stale the instant a connection actually drops during the outage that
caused a restart, and the same logic applies to a restored name).

### Decision: Display name persists in `sessionStorage`, not `localStorage`
Once set, a display name should carry over when the same browser tab
navigates between different rooms in one sitting — re-asking on every
single room would be tedious and isn't what "session-scoped" is meant to
protect against. But it must not survive an actual browser restart
(`identity`'s "Display Name Does Not Persist Across Sessions"
requirement) — `sessionStorage` is exactly this: scoped to the tab's
lifetime, cleared when it closes, unlike `localStorage`.

### Decision: The join gate lives inside the room page, not a separate route
Rather than a dedicated `/join` route, `app/pages/room/[id].vue`
conditionally renders a name-entry prompt in place of the room UI until
a display name exists (from `sessionStorage` or freshly entered), then
reveals the room. This matches the existing `audioUnlocked` pattern
already in that same file (a readiness gate rendered inline, not a
redirect) rather than introducing a new navigation flow for what is
fundamentally the same kind of "not ready yet" state.
`app/plugins/websocket.client.ts`'s connection `watch()` gains the
display name as a second dependency alongside the route's room ID —
the room's WebSocket does not open at all until both exist.

### Decision: Transport bar is a compact control in the existing room header, not a new UI region
`app/pages/room/[id].vue`'s header already holds the room title,
presence count, and invite-link button. Tempo (current BPM, a control to
change it, calling the already-implemented `sendSetTempo`) joins that
same header rather than introducing a separate toolbar — the roadmap's
"transport bar" is a UI category from `03-architecture-frontend.md`
written before any concrete room-header layout existed, not a
prescription for a distinct visual region.

## Risks / Trade-offs

- [Risk] No ownership check on `set_tempo` means any connected client —
  not just track owners — can change a room's shared tempo. → Mitigation:
  this is existing, already-shipped server behavior from Phase 3, not
  introduced here; revisit only if it proves to be a real problem in
  practice (e.g. restricting to track owners collectively, or requiring
  agreement).
- [Risk] A display name is free-text with no unique-per-room enforcement
  — two clients in the same room can pick identical names. → Mitigation:
  accepted; presence and ownership always key on connection ID
  underneath, name is purely a label. Not disambiguating duplicate names
  visually is a minor, acceptable UX gap for this app's scale.
- [Risk] `sessionStorage` is per-tab, not per-browser — opening a second
  tab to the same room prompts for a name again. → Mitigation: accepted
  as consistent with "session-scoped," not a bug; a user running two
  tabs is arguably two distinct participants anyway.
- [Discovered during testing, not a bug] The join gate's own "Join"
  click satisfies the browser's audio-unlock gesture requirement
  (`app/lib/audioEngine.ts`'s `initAudioOnFirstClick`) before the room
  ever renders, since it's the same page load and any click anywhere
  counts. In the normal flow, the audio-unlock banner from Phase 3 can
  now essentially never appear — the join gate's click already handles
  it. It still can appear in one real case: a fresh page load where a
  display name already exists in `sessionStorage` from a previous room
  in the same tab, so the gate is skipped and the room renders with no
  prior click yet. The e2e test for that banner
  (`e2e/multi-client.spec.ts`) was rewritten to exercise exactly that
  case instead of the now-gated normal path.
