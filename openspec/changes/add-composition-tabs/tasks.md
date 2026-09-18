## 1. Tab shell

- [x] 1.1 Add an `activeTab` ref (`'composition' | 'chat' | 'ascii'`,
      default `'composition'`) to `app/pages/app/composition/[id].vue`,
      replacing `showAsciiPanel` and `panelOpen`.
- [x] 1.2 Move the editor + canvas backdrop markup into a Composition
      tab body, the roster + chat markup into a Chat tab body, and the
      ASCII art markup into an ASCII Art tab body — each rendered only
      when `activeTab` matches, with no other behavior change yet.
- [x] 1.3 Removed the old `ascii-panel` / `side-panel` docked-aside
      wrapper markup and the two old toggle buttons.

## 2. Tab switcher

- [x] 2.1 Build one tab-button definition list (icon, label,
      activity-indicator state) shared by both placements.
- [x] 2.2 Render the switcher in the room header at `md+` widths.
- [x] 2.3 Render the switcher as a `fixed bottom-0` bar (with
      `env(safe-area-inset-bottom)` padding) below `md`.
- [x] 2.4 Wire keyboard shortcuts (`1`/`2`/`3`) to switch tabs, ignored
      while focus is inside the editor or a text input.

## 3. Playback + activity indicators

- [x] 3.1 Add a persistent playing/stopped indicator to the room
      header, reading the existing playback state, visible regardless
      of `activeTab`.
- [x] 3.2 Move the existing chat-unread-count logic from
      `toggle-panel-button` onto the Chat tab button; clear it when
      `activeTab` becomes `'chat'`.
- [x] 3.3 Add a `compositionActivity` flag that sets on an
      evaluation broadcast received while `activeTab !== 'composition'`
      and clears when `activeTab` becomes `'composition'`; show it on
      the Composition tab button.

## 4. Clear the shared document

- [x] 4.1 Add a "Clear" control to the Composition tab's toolbar, next
      to the existing starter-preset dropdown, rendered only when the
      local participant's role is `editor`.
- [x] 4.2 Gate the actual clear behind an inline confirm/cancel step
      (matching `account.vue`'s existing destructive-action pattern,
      not a `UModal`) before firing.
- [x] 4.3 On confirm, set the shared Yjs document's text to empty via
      the existing document-sync path (no new message type).

## 5. Chat tab layout reservation

- [x] 5.1 Add a zero-height, currently-empty control-strip region to
      the bottom of the Chat tab's body, below the message input, for
      `add-jah-chat` to populate later.

## 6. Rework affected e2e coverage

- [x] 6.1 `e2e/composition.spec.ts` — retargeted roster/chat visibility
      and panel-toggle assertions to the new tab testids; the old
      "panel toggles as an overlay" test is now "tabs are mutually
      exclusive on a narrow screen."
- [x] 6.2 `e2e/ascii-panel.spec.ts` — retargeted panel toggle/visibility
      assertions to the ASCII Art tab.
- [x] 6.3 `e2e/mobile-rooms.spec.ts` — retargeted header-button-based
      responsive checks to the new responsive tab switcher (header vs.
      bottom bar), and the "Load a starter" overflow-menu assertion to
      its new Composition-tab-toolbar location.
- [x] 6.4 `e2e/oauth.spec.ts` — the avatar-in-room test needed one fix:
      chat-input is now behind the Chat tab (hidden by default), so the
      test now switches to it before sending a message.

## 7. Verify + ship

- [x] 7.1 `nuxt typecheck`, `vitest run` green (114/114).
- [x] 7.2 `npm run test:e2e` — full suite: 57 passed, 1 flaky
      (`jam-audio.spec.ts`, unrelated JAM claim-button race, passed on
      retry), 1 failed (`oauth.spec.ts`'s avatar/room test — the same
      pre-existing/environmental timeout confirmed unrelated to this
      session's other changes via a clean-checkout comparison).
- [x] 7.3 `openspec validate add-composition-tabs --strict` — passes.
- [ ] 7.4 `npm run deploy`; manually verify on `jaime.stream`: tab
      switching on desktop and mobile, keyboard shortcuts, playback
      indicator persists across tabs, chat/composition activity
      indicators, clear-document confirm-and-role-gate.
- [ ] 7.5 Sync the `composition-room` delta; archive the change.
