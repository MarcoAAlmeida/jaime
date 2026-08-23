## Why

Presence and track ownership currently show only opaque connection IDs — nobody can tell *who* owns a track or *who* else is in the room, undermining the point of the collaboration features Phases 4/5 already built. Separately, the transport clock (tempo, phase-locked synchronized start) has had full protocol support since Phase 3 (`set_tempo`/`tempo_update`) but no UI ever calls it — nobody can actually change a room's tempo today. Phase 6 of the roadmap (`docs/04-roadmap.md`) closes both gaps: session-scoped identity (no accounts needed) and a transport bar exposing the tempo control that's been sitting unused in the protocol.

## What Changes

- A join screen: before entering a room — whether creating one or following an invite link — a user sets a display name for that session. No accounts, no persistence across sessions, matching the roadmap's own framing ("no need for full user accounts to start — a session display name is enough").
- Presence and track ownership show that display name instead of an opaque connection ID.
- A transport bar: shows the room's current tempo and lets any client change it, using the `set_tempo` message that has existed since Phase 3 but never had a UI.
- **Dropped from this phase's scope**: custom domain, also listed under this roadmap phase — premature before an MVP exists, per explicit direction; left for its own small change later.

## Capabilities

### New Capabilities
- `identity`: lets a user set a session-scoped display name before joining a room.
- `transport-controls`: lets a user view a room's shared tempo and change it.

### Modified Capabilities
- `presence`: the roster shown to clients includes each connection's display name, not just its ID.
- `track-ownership`: the "Ownership Visible" requirement identifies an owning client by display name.

## Impact

- New client-side "join" step gating room entry on a display name being set, for both the create and the join-by-link/code paths.
- `shared/roomProtocol.ts`: presence entries and track ownership carry a display name alongside the existing connection ID.
- `server/routes/room.ts`: room state gains a per-connection display name; `set_tempo`'s handling is already implemented and unchanged — this phase adds the missing UI that calls it.
- New transport bar UI (room header) showing/editing BPM.
- Out of scope: full user accounts, identity persisting across sessions, custom domain.
