## Why

Every visitor currently lands in the same hardcoded room — there's no way for separate groups to jam independently, and no way to tell who else is actually connected to a session. Phase 4 of the roadmap (`docs/04-roadmap.md`) calls for dynamic rooms (create/join by ID) and a presence list, which is also the natural point to shrink the track roster: with rooms becoming a real, shareable unit, two open tracks per room — DJ decks, not instrument-typed slots — gives each pair more room to get creative than four fixed instrument roles did.

## What Changes

- Landing page (`/`) becomes real: **Create a room** (generates an ID, no round trip) or **Join a room** (paste a link or type a short code).
- The room route becomes `/room/[id]`, replacing the hardcoded `/jam`. Rooms become isolated from each other by room ID (message routing and presence scoped per ID) instead of every client sharing one undifferentiated room.
- A presence roster: every client connected to a room is broadcast to everyone else in that room as they join and leave.
- **BREAKING**: the fixed track roster shrinks from 4 instrument-typed slots (`drums`/`bass`/`lead`/`pad`) to 2 generic, unthemed tracks — no implied instrument or starter genre, each owner scripts whatever they want. Existing single-room URLs and the 4-track starter content stop working as they do today.

## Capabilities

### New Capabilities
- `room-lifecycle`: creating a new room, joining an existing room by ID or link, and the landing page flow that offers both.
- `presence`: shows every client in a room who else is currently connected.

### Modified Capabilities
- `realtime-room`: the Room Connection requirement changes from "a single hardcoded room" to "the room identified by the URL."

## Impact

- `app/pages/index.vue` (currently a redirect stub) becomes the real landing page.
- `app/pages/jam.vue` moves to a dynamic route, `app/pages/room/[id].vue`.
- `server/routes/room.ts` keys its in-memory state by room ID and scopes broadcasts per room instead of one flat, room-less state (see design.md for why this is an in-memory partition rather than separate Durable Object instances).
- `app/plugins/websocket.client.ts` connects to `/room/<id>` instead of a fixed path.
- `shared/tracks.ts`: roster reduced to 2 generic tracks; starter `DEFAULT_CODE` reworked to match (no instrument theming).
- `shared/roomProtocol.ts`: new presence-related message(s).
- No changes to track ownership, pattern relay, or transport-clock mechanics themselves — this phase is scoped to room addressing and presence, per `track-ownership` and `transport-clock`'s existing specs, which don't name the roster and stay valid as-is.
