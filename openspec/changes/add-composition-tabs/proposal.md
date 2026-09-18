## Why

The Composition Room's editor pane and two independently-toggleable
panels (ASCII art, chat/roster) compete for the same screen space: on
desktop, opening both panels alongside the editor makes three
competing columns; on mobile, both panels are absolutely positioned in
the same spot, so opening one covers the other outright. Replacing the
docked-panel model with a tabbed interface — one view visible at a
time, the editor included — removes the competition entirely and gives
each view (Composition, Chat, ASCII Art) the full pane to itself.

## What Changes

- **BREAKING**: The always-visible editor + two independently-toggleable
  docked panels are replaced by three mutually-exclusive tabs —
  Composition (editor + canvas backdrop), Chat (roster + messages),
  and ASCII Art — with exactly one visible per viewer at a time.
- The participant roster and the ephemeral chat, previously stacked in
  one side panel, combine into the single Chat tab.
- Tab selection is a per-viewer, unsynced choice (like today's local
  panel-open state) — switching your own tab never affects what
  anyone else in the room sees.
- The tab switcher lives in the header on wider viewports and moves to
  a bottom bar on narrow viewports; tabs are also switchable by
  keyboard shortcut.
- A persistent, always-visible playback indicator is added to the room
  header, independent of which tab is active.
- Inactive tabs show a lightweight activity indicator: an unread count
  on Chat (moved from today's toggle button), and a discrete indicator
  on Composition when someone evaluates the document while you're on
  a different tab.
- The Chat tab's body reserves layout space for a control strip that
  stays empty/unused in this change — a placeholder for the richer
  controls (file upload, model/parameter selection) planned for the
  upcoming `add-jah-chat` change, so that change doesn't need to
  rework this tab's structure.
- A new "clear the shared document" control is added to the
  Composition tab's toolbar, next to the existing starter-preset
  dropdown: editor-role-gated (a viewer cannot trigger it) and
  requires explicit confirmation before it blanks the shared document
  for every participant.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `composition-room`: removes the independently-toggleable,
  docked-beside-editor ASCII panel requirement; modifies the chat and
  presence requirements to reflect their new home in the Chat tab;
  adds requirements for the tabbed structure itself (three tabs, one
  visible at a time, per-viewer selection, keyboard/responsive
  switching), the persistent playback indicator, inactive-tab activity
  indicators, and the role-gated, confirmed document-clear control.

## Impact

- `app/pages/app/composition/[id].vue` — the room's page component,
  substantially restructured (tab shell replaces the docked-aside
  layout).
- e2e coverage requiring rework: `e2e/composition.spec.ts`,
  `e2e/ascii-panel.spec.ts`, `e2e/mobile-rooms.spec.ts`, and the
  avatar-in-room assertions in `e2e/oauth.spec.ts` (see design.md for
  the specifics).
- No server-side, schema, or persistence changes — this is entirely
  client-side room UI; the shared Yjs document, presence, and chat
  broadcast mechanisms are unchanged, only how they're presented.
