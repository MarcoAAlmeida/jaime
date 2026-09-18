## Why

The Composition Room header currently cramps the logo, status badges, playback controls, share button, and tab switcher into a single flex-wrap row. This layout doesn't scale beyond 3 tabs—as we grow toward 6+ tabs (future phases include more viewing modes and tools), the header becomes unusable. Additionally, each tab's context-specific toolbar (e.g., "Load a starter" for Composition, "Shuffle" for ASCII Art) adds a second bar, creating visual noise and poor hierarchy.

## What Changes

Restructure the Composition Room header into three semantic zones:

- **Zone 1 (Global Identity & Status)**: Logo, connection status badge, playback status badge, Play/Stop button, Share/Invite button. Always visible, always concise.
- **Zone 2 (Tab Bar)**: Full-width, scrollable tab switcher (Composition, Chat, ASCII Art, future tabs). No longer compressed into Zone 1.
- **Zone 3 (Context Toolbar)**: Tab-specific controls (e.g., "Load a starter" + "Clear" for Composition, "Shuffle" for ASCII Art). Empty or minimal for other tabs. Height is dynamic based on content.
- **Mobile Layout**: All three zones stack vertically, each taking full width.

**Removals**: Remove "Switch to viewer" button (unnecessary—role toggle can live in tab-specific menus if needed later, or remain editor-only).

## Capabilities

### New Capabilities
(None)

### Modified Capabilities
- `composition-room`: adds the three-zone header layout (global controls,
  tab bar, context toolbar) as a specified requirement; removes the
  "Switch to viewer" button; and, since that button was the only in-room
  trigger for switching role, removes the in-room role-switch capability
  itself — role becomes fixed for the session once chosen at join
  (leaving and rejoining is how to pick a different one).

## Impact

- **UI Layout**: Header structure and CSS in `app/pages/app/composition/[id].vue`.
- **Responsive Breakpoints**: Zone 3 (toolbar) may need different spacing at various widths; Zone 2 (tabs) becomes full-width.
- **Mobile Navigation**: Bottom tab bar (already exists for mobile) remains in place; top header reorganizes above it.
- **No Backend Changes**: Communication protocol, presence, chat, playback—all unchanged.
- **Future-Proof**: Layout pattern can accommodate 6+ tabs without redesign.
