## Context

Currently, `app/pages/app/composition/[id].vue` renders the header as a single `flex flex-wrap items-center justify-between gap-2` container holding the logo, status badges, play button, role switch, share button, and (on md+) the tab switcher. This flex-wrap causes clutter when tabs exceed 3 and doesn't scale. Each tab's toolbar (Composition's "Load a starter" / "Clear", ASCII Art's "Shuffle", etc.) is rendered as a separate `border-b p-2` bar below the tab switcher.

## Goals / Non-Goals

**Goals:**
- Separate header into three visual zones with clear responsibilities (global state, navigation, context actions).
- Support 6+ tabs without layout breakage; tab bar becomes scrollable if needed.
- Dynamic Zone 3 (context toolbar) height—doesn't waste space when empty.
- Mobile-friendly stacking of all three zones without side-by-side compression.
- Maintain all existing functionality (play/stop, share, status, tab switching, tab-specific controls).

**Non-Goals:**
- Migrate Zone 1 controls to any other location (always top, always visible).
- Change the communication or state management for playback, chat, or presence.
- Redesign the mobile bottom tab bar (remains separate, below the fold).
- Implement a role-switching UI (remove "Switch to viewer" button entirely).

## Decisions

### 1. Three-zone layout as grid of rows

Use `flex flex-col` on the root container:
- Zone 1: `flex items-center justify-between` row with logo (left) and controls (right).
- Zone 2: `flex items-center gap-0.5 overflow-x-auto` row with scrollable tab list.
- Zone 3: `flex flex-wrap gap-2` row with context controls, hidden (`v-if` or `h-0`) when empty.

**Rationale**: Rows are simpler than CSS Grid for this layout, and `overflow-x-auto` on Zone 2 naturally handles tab overflow. Flex-wrap in Zone 3 lets controls wrap if needed without breaking the row structure.

**Alternative considered**: CSS Grid with template rows—adds complexity for minimal benefit here.

### 2. Mobile stacking via `flex-col`

Default (all widths) is `flex-col`. No media query toggling needed—all zones naturally stack on mobile and desktop.

**Rationale**: Simpler than `md:grid-flow-row` toggling, and the layout already works vertically by default.

### 3. Tab bar scrolls horizontally on overflow

Zone 2 is `overflow-x-auto` by default. No dropdown fallback; users scroll tabs left/right.

**Rationale**: Keeping this decision deferred (as you noted) until we hit 6+ tabs. The `overflow-x-auto` is the safe default. If later we find horizontal scrolling is awkward on mobile, we can add a dropdown—but we don't need to solve that now.

**Alternative considered**: Dropdown "more tabs" menu—adds complexity and a decision point we don't need yet.

### 4. Zone 3 (context toolbar) uses `v-if` for visibility

Each tab's controls are rendered only when that tab is active. If no controls exist for a tab, Zone 3 is not rendered at all (truly zero height, not `h-0`).

```vue
<div v-if="showContextToolbar" class="flex flex-wrap gap-2 border-b p-2">
  <!-- composition: Load a starter + Clear -->
  <!-- chat: (empty, not rendered) -->
  <!-- ascii: Shuffle -->
</div>
```

**Rationale**: Avoids invisible space and is cleaner than `h-0` with conditional content.

### 5. Zone 1 controls layout: logo left, controls right

```html
<div class="flex items-center justify-between">
  <Logo />
  <div class="flex items-center gap-2">
    <!-- Connected, Stopped, Play, Share -->
  </div>
</div>
```

Logo on left (brand identity), controls on right (actions). No change from current, just extracted as Zone 1.

### 6. Remove "Switch to viewer" button and the in-room role switch entirely

This button was the only trigger for `toggleRole()` (the other was the
same action folded into the mobile overflow menu). Removing it without
another way to trigger a role change would leave the capability
unreachable but still specified — so the capability itself is removed:
role becomes fixed once chosen at the join gate, for the rest of that
session. `toggleRole()` and both its call sites are deleted. The base
`composition-room` spec's "Choose Editor Or Viewer On Join" requirement
is updated accordingly (see this change's `specs/composition-room/spec.md`),
and `e2e/composition.spec.ts`'s test that exercises the switch is
rewritten to assert a viewer stays a viewer instead.

**Rationale**: confirmed with the user — dropping the capability
outright (not relocating its UI) is the chosen resolution, since
relocating it (e.g. into the Chat tab) was the alternative and was not
picked.

**Alternative considered**: relocate the same `toggleRole()` trigger
into the Chat tab's roster instead of deleting the capability — keeps
the base spec's existing behavior, costs a bit more UI. Not chosen.

## Risks / Trade-offs

- **Horizontal scrolling tabs on mobile** (Zone 2): If a user has 6+ tabs open at once, they need to scroll within the tab bar. This is acceptable and follows common tab UI patterns (browser tabs, Slack channels). If testing shows it's awkward, we can revisit with a dropdown or pagination—but `overflow-x-auto` is the safe starting point.
- **Zone 3 conditional rendering**: If a tab's controls are expensive to compute, they're not rendered until that tab is active—saving work. No downside here.
- **No fixed height budget**: Zone 3 grows/shrinks per tab. Doesn't cause layout jank (it's already below content), but if we need predictable space later, we can reserve a min height.

## Migration Plan

1. Refactor `[id].vue` header template:
   - Extract Zone 1 (logo + status + play + share) into its own `<div>` with clear zone class/comment.
   - Extract Zone 2 (tab switcher) into its own `<div>`, make scrollable if not already.
   - Extract Zone 3 (context controls) into per-tab conditional blocks.
2. Verify responsive behavior: stack zones on mobile (default in flex-col), horizontal layout on desktop (already works).
3. Remove "Switch to viewer" button.
4. CSS updates: add `overflow-x-auto` to Zone 2, adjust padding/gaps as needed.
5. Test: manually verify all tabs and their controls render correctly, Play/Stop/Share work from any tab, scrolling works if tabs overflow.

**Rollback**: Revert the commit. No data or state changes.

## Open Questions

- On mobile, should Zone 1 also stack (logo on one line, controls on the next), or stay inline? Current design assumes inline is fine; can adjust in implementation if testing shows cramping.
- If we later add a 7th tab and scrolling becomes tedious, do we want a tab dropdown or just accept the scroll? Decision deferred until we actually have 6+ tabs.
