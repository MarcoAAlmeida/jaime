## 1. Refactor Header Template Structure

- [x] 1.1 Identify and extract current header markup from `[id].vue` (lines 556–661, approximately)
- [x] 1.2 Create Zone 1 (logo, status badges, play button, share button) as a distinct `<div>` block
- [x] 1.3 Extract Zone 2 (tab switcher) into its own `<div>` and add `overflow-x-auto` for scrolling support
- [x] 1.4 Extract Zone 3 (context toolbar) into per-tab conditional blocks (Composition controls, ASCII shuffle, empty for Chat)
- [x] 1.5 Wrap all three zones in a root `flex flex-col` container

## 2. Remove "Switch to Viewer" Button And The In-Room Role Switch

- [x] 2.1 Delete the "Switch to viewer" button from Zone 1 markup and
      from the mobile overflow menu's items
- [x] 2.2 Delete `toggleRole()` and its `data-testid="toggle-role-button"`
      call sites entirely — the capability is removed, not relocated
      (also removed the now-dead `role` WS message: client
      `compositionProvider.setRole`, server `composition.ts` handler,
      and the `{ t: 'role' }` protocol member)
- [x] 2.3 Rewrite `e2e/composition.spec.ts`'s "a viewer cannot edit the
      document; switching to editor lets them" test: drop the
      switch-to-editor portion, keep/assert the viewer-cannot-edit
      portion, rename the test
- [x] 2.4 Update `e2e/mobile-rooms.spec.ts`'s references to
      `toggle-role-button` and the "Switch to viewer" menu item
      (both currently asserted present)

## 3. Update Zone 3 Visibility and Layout

- [x] 3.1 Make Zone 3 conditionally render with `v-if` (don't render if no controls for active tab)
- [x] 3.2 Ensure Composition tab renders "Load a starter" and "Clear" buttons in Zone 3
- [x] 3.3 Ensure ASCII Art tab renders "Shuffle" button in Zone 3
- [x] 3.4 Ensure Chat tab renders Zone 3 as empty (or not at all when chat is active)

## 4. Test Responsive Behavior

- [x] 4.1 Test desktop (md+): all zones display as rows, no wrapping, tabs are scrollable if many
- [x] 4.2 Test mobile (<md): zones stack vertically, each takes full width
- [x] 4.3 Verify Play/Stop button works when Chat tab is active
- [x] 4.4 Verify Share button works when ASCII Art tab is active
- [x] 4.5 Verify tab switching updates active tab styling and Zone 3 content
- [x] 4.6 Verify Zone 3 appears/disappears correctly when switching between tabs with and without controls

## 5. Browser Verification

- [x] 5.1 Open Composition Room in browser and verify layout at desktop width
- [x] 5.2 Resize to mobile width and verify stacking behavior
- [x] 5.3 Test all global controls (Play, Stop, Share) from each tab
- [x] 5.4 Test all tab-specific controls (Load starter, Clear, Shuffle) from their respective tabs
- [x] 5.5 Test switching between tabs and verify Zone 3 updates
- [x] 5.6 Create a room with multiple participants and verify everything still works
      (covered by the e2e suite: 3-client, cursor, chat, and role tests
      all pass against this layout)

## 6. Final Polish

- [x] 6.1 Review CSS and ensure no redundant or conflicting styles remain from the old header
- [x] 6.2 Ensure consistent spacing and padding between all three zones
- [x] 6.3 Run any existing tests to confirm no regressions
      (composition.spec.ts, mobile-rooms.spec.ts, ascii-panel.spec.ts:
      22/22 pass; typecheck clean. `oauth.spec.ts`'s unrelated
      "no name prompt, avatar shown" test was flaky in this session —
      two different failure modes across three runs, no touched code
      in its path — noted for separate follow-up, not blocking)
- [x] 6.4 Take a final screenshot or video to confirm the design matches the spec
      (desktop + mobile screenshots taken during manual verification;
      matches all spec scenarios)
