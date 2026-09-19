## Context

See `proposal.md` for motivation. Three independent, small changes to
the same two entry flows (JAM room join, Composition Room join):

- Composition Room's join gate (`app/pages/app/composition/[id].vue`)
  has a `v-else-if="!role"` block with "Editor"/"Viewer" buttons
  calling `chooseRole('editor' | 'viewer')`. JAM has no equivalent —
  its room page goes straight from the name gate into per-track
  claiming.
- Both room pages gate on `!displayName` (from the shared
  `useDisplayName` composable) and show a `nameInput` ref, currently
  initialized to `''`.
- The Pattern Library (`app/pages/app/patterns.vue`) already has
  `loadIntoJam(pattern)` → `navigateTo('/app/jam/room/${nanoid(10)}?load=${pattern.id}')`.
  JAM's room page reads `route.query.load`, fetches
  `/api/patterns/:id`, and seeds track A once claimed
  (`app/pages/app/jam/room/[id].vue`, the `wantsLoad`/`loadPhase`
  state machine).

## Goals / Non-Goals

**Goals:**
- Remove the editor/viewer button step from Composition Room's join
  flow without touching the role machinery underneath it.
- Suggest a display name by default everywhere one is asked for,
  without silently overriding a real signed-in or previously-chosen
  name.
- Give Composition Room the same "start a room from this pattern"
  entry point the Pattern Library already gives JAM.

**Non-Goals:**
- Not deleting `Role`, `isEditor`, server-side role handling, or
  viewer read-only enforcement — confirmed explicitly with the user:
  kept dormant, not removed, for a possible future spectator use case.
- Not adding new Enter-key handling. Both landing pages' join-by-code
  inputs and both room pages' name inputs already have `@keyup.enter`.
  Once the editor/viewer buttons are gone, no button-only step remains
  before entering a room. Flagged in the proposal for the user to
  confirm rather than assumed silently — if that reading's wrong, the
  fix is a one-line `@keyup.enter` addition wherever it's missing, not
  a design change.
- Not building name-suggestion preferences, regeneration UI, or a
  "shuffle" button — one suggestion, editable, is enough per the
  chosen option ("auto-generated fun name, pre-filled").

## Decisions

### 1. Auto-assign editor client-side, before the existing `join` message
`chooseRole('editor')` runs automatically wherever the role gate used
to render — no new state machine, no server change. The server's
`join` message and its `role` field are untouched; they just always
carry `'editor'` from this client now. `toggleRole()` and the
in-room switch stay gone (removed by `refactor-composition-header`);
this change only removes the *initial* choice, per the "Every Joiner
Is Automatically An Editor" requirement.

**Alternative considered**: have the server default an omitted `role`
to `'editor'` — rejected, since the client already always sends a
role today and changing the server's contract isn't needed to satisfy
"no UI step."

### 2. A small local name generator, no new dependency
`app/lib/suggestedName.ts` exports `randomDisplayName(): string` —
picks from two small local word lists (adjective + creature/object)
and joins them, e.g. "Curious Otter". Both room pages initialize
`nameInput` with it instead of `''`:
```ts
const nameInput = ref(randomDisplayName())
```
Nothing else changes — the existing `v-if="!displayName"` gate, the
`UInput`, and the `@keyup.enter="submitName"` handler are all already
in place and already accept whatever's in the field, generated or
typed.

**Alternative considered**: a slider/chip picker of 3-5 suggestions —
rejected per the chosen option; adds a second UI element for a single
low-stakes value the user can already freely edit.

### 3. Composition Room's `?load=` is simpler than JAM's — no claiming step
JAM's `?load=` waits for the client to own track A before seeding,
because tracks have per-track ownership. Composition Room's document
has no ownership step — any editor can write to it. So the sequence
inside the existing `async start()` (right where `STARTER_DOC` is
inserted today) becomes:

```ts
if (isEditor.value && provider.text.length === 0) {
  const loadId = route.query.load
  const seed = typeof loadId === 'string' && loadId
    ? await $fetch<{ code: string }>(`/api/patterns/${encodeURIComponent(loadId)}`)
        .then(p => p.code).catch(() => null)
    : null
  provider.text.insert(0, seed ?? STARTER_DOC)
  if (loadId) router.replace({ query: {} }) // strip for a clean link, mirrors JAM
}
```
Same race the existing comment already documents (`provider.text.length === 0`
makes a same-instant double-entry the only race, duplicating canned
text) — unaffected by adding a fetch in front of it.

**Alternative considered**: mirror JAM's full `loadPhase` state machine
and `load-notice` banner — rejected, that machinery exists in JAM
specifically to explain a wait for "claim a track first"; Composition
Room has no such wait, so a loading state would be added complexity
with nothing to communicate.

### 4. Viewer stays reachable via `?role=viewer`, not just dormant code
Removing the buttons means `e2e/composition.spec.ts`'s `joinRoom`
helper — which every test uses, not just the viewer-specific one —
can no longer click `[data-testid="role-${role}"]`, because that
element won't exist. Rather than leave viewer enforcement completely
unreachable (and its e2e coverage deleted), a Composition Room link
accepts `?role=viewer`: opening `/app/composition/<id>?role=viewer`
joins as a viewer, exactly as the button used to, with nothing in the
UI ever surfacing or hinting at the link. This is the concrete form
of "kept dormant for later" from the proposal — not just inert code,
a real, working, already-testable path, just not one any button leads
to. `chooseRole` still exists and still runs; only *what triggers it*
changes (a query param instead of a click), for whichever role isn't
the automatic default.

**Alternative considered**: drop e2e coverage for the viewer path
entirely (skip/delete the test) — rejected; it costs nothing to keep
a query-param path, and "can become useful in the future" is truer of
something that still works today than of dead code.

### 5. "Load into Composition Room" button placement
Add it next to "Load into JAM" in the same per-pattern action row
(`app/pages/app/patterns.vue`), same style, calling
`navigateTo('/app/composition/${nanoid(10)}?load=${encodeURIComponent(pattern.id)}')` —
byte-for-byte the same shape as `loadIntoJam`, just a different route.

## Risks / Trade-offs

- **A returning user's browser could show a stale suggested name if
  they cleared it and reloaded** → Not a real risk: the suggestion is
  regenerated fresh (`randomDisplayName()` runs again) on every mount
  where `!displayName`; nothing persists a rejected suggestion.
- **Dormant viewer code could bit-rot unnoticed** (per Non-Goals,
  kept but unreachable) → Mitigation: per Decision 4, `?role=viewer`
  keeps the path genuinely reachable (and testable) even though no
  button leads to it — `e2e/composition.spec.ts`'s viewer test
  continues to exercise real enforcement, not a stub.
- **Two independent room pages (JAM, Composition) both need the name
  generator** → Mitigation: it's one small pure function with no
  page-specific logic, imported by both; no shared-state risk.

## Migration Plan

1. Add `app/lib/suggestedName.ts`.
2. Composition Room: remove the `!role` gate's Editor/Viewer buttons
   entirely. On mount, call `chooseRole('editor')` automatically
   unless `route.query.role === 'viewer'`, in which case call
   `chooseRole('viewer')` instead (Decision 4). Keep `chooseRole`,
   `Role`, `isEditor`, and everything downstream unchanged.
3. Both room pages: initialize `nameInput` with `randomDisplayName()`.
4. Composition Room: add `?load=` seeding in `start()` as in Decision 3.
5. Pattern Library: add "Load into Composition Room" per Decision 5.
6. Update `e2e/composition.spec.ts`'s `joinRoom` helper: replace the
   `page.locator('[data-testid="role-${role}"]').click()` step —
   for `role === 'editor'` (the new default) there's nothing to click;
   for `role === 'viewer'`, navigate to `?role=viewer` instead of
   clicking a button that no longer exists. Every other test using
   this helper is otherwise unaffected — they just stop clicking a
   button implicitly.
7. Update `e2e/mobile-rooms.spec.ts`'s references to `role-editor`
   (it currently clicks that button to get into a room at all) the
   same way — drop the click, since editor is now the default with
   no button required.

Rollback: every piece is additive or UI-only (no data/schema/protocol
change) — reverting the commit is sufficient if needed.
