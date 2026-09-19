## Why

Trying the app live surfaced three points of friction between the
landing pages and actually being in a room: Composition Room's
editor/viewer choice is an extra click that adds no value today (no
real audience for read-only viewing yet), the display-name prompt
forces typing before a user can see anything, and the Pattern Library
can seed a JAM room from a pattern but has no equivalent for
Composition Room — even though `add-favorite-patterns` just made the
two systems share one catalog.

## What Changes

- **BREAKING** (user-facing, not data): Composition Room's join gate no
  longer asks "Editor or Viewer?" — every joiner (room creator or
  someone opening a shared link) is automatically an editor. The
  underlying `Role` type, `isEditor` checks, server-side role
  handling, and viewer read-only enforcement all stay in the code
  exactly as they are today — nothing is deleted, the choice is just
  never shown, per explicit decision to keep the capability available
  for later (e.g. once there's real traffic to justify read-only
  spectators).
- The display-name prompt (shared by JAM and Composition Room via
  `useDisplayName`) arrives pre-filled with an auto-generated,
  editable suggested name instead of an empty required field. A user
  can accept it immediately (click or Enter) or type their own.
- Add "Load into Composition Room" to the Pattern Library, next to the
  existing "Load into JAM" — opens a fresh Composition Room seeded
  with that pattern's code (via `?load=<patternId>`, mirroring JAM's
  existing mechanism), instead of the generic starter document.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities
- `composition-room`: "Editor Or Viewer Is Chosen Once, At Join"
  changes from a self-declared choice to an automatic default —
  every joiner is an editor, with no UI step. Requirements describing
  viewer behavior (e.g. "A Viewer's Editor Is Strictly Read-Only")
  are intentionally left unchanged — they describe real enforced
  behavior for the (currently unreachable) case where a participant
  is a viewer, kept dormant rather than deleted.
- `pattern-library`: adds "A Pattern Can Be Loaded Into A Composition
  Room", alongside the existing "...Loaded Into JAM" requirement.
- `identity`: "Display Name Required To Join A Room" is joined by a
  new scenario — the prompt suggests a name by default rather than
  starting empty; the user is still prompted (nothing changes about
  *whether* they see the gate), only what greets them there.

## Impact

- **UI**: `app/pages/app/composition/[id].vue` (drop the `!role` gate,
  auto-call `chooseRole('editor')`; add `?load=` seeding), shared
  name-entry gates in both room pages (pre-filled suggestion),
  `app/pages/app/patterns.vue` (new "Load into Composition Room"
  button).
- **New util**: a nickname generator, called from wherever the
  name-entry `nameInput` ref is initialized in each room page (exact
  placement decided in design.md).
- **No API/schema changes**: `?load=` reuses the existing
  `GET /api/patterns/:id` endpoint JAM's loader already calls.
- **No server-side protocol changes**: role defaults client-side to
  `'editor'` before the existing `join` message is sent — the
  server's join/role handling is untouched.
- **Already satisfied, flagged not assumed**: the "use Enter on
  desktop" request — both landing pages' join-by-code inputs and both
  room pages' name inputs already have `@keyup.enter` handlers. Once
  the editor/viewer button step is removed, no button-only step
  remains before entering a room, so no further Enter-key work
  appears necessary. Confirm this reading is right before considering
  it done.
