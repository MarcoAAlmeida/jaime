## 1. Editor: no horizontal scroll on narrow viewports

- [ ] 1.1 `app/lib/strudelEditor.ts` — add a `lineWrapping` `Compartment`
      (alongside the `editable` one), appended via `StateEffect.appendConfig`.
      Expose `setLineWrapping(on: boolean)` on the returned `StrudelEditor`.
- [ ] 1.2 `app/components/TrackEditor.vue` — drive `setLineWrapping` from
      the existing `ResizeObserver` (debounced): wrap on when the host is
      below ~640px, off above. Re-apply after the async editor build,
      same as `props.code` / `props.editable`.
- [ ] 1.3 `app/pages/app/composition/[id].vue` — same wiring off its
      editor host `ResizeObserver`.
- [ ] 1.4 Verify: a line longer than the viewport wraps (content width ≤
      viewport, no horizontal scrollbar); on a wide viewport lines are
      not force-wrapped; cursor/selection stay correct across a
      wrap-toggle (rotate).

## 2. Room header reflows

- [ ] 2.1 `app/pages/app/composition/[id].vue` — header row `flex-wrap`;
      move Load-a-starter / Switch-role / Copy-invite into a
      `UDropdownMenu` "⋯" shown only below `sm`, Play/Stop + connection
      badge stay inline. Preserve every `data-testid` (onto the menu
      items).
- [ ] 2.2 `app/pages/app/jam/room/[id].vue` — same treatment for its
      header (BPM, presence, copy-invite, per-track controls stay
      reachable); `h-screen` → `h-dvh` on the outer wrapper.
- [ ] 2.3 Composition Room: chat input / bottom controls get
      `min-h-0` + safe-area padding so an overlaying mobile browser
      toolbar doesn't cover them.
- [ ] 2.4 Verify at a phone portrait viewport and a short landscape
      viewport: logo + every control visible, nothing overlapping,
      every control operable (open the ⋯ menu where collapsed).

## 3. Share a room in one action

- [ ] 3.1 `app/composables/useShareLink.ts` — `share()` = `navigator.share`
      when `navigator.canShare?.({ url })`, else clipboard copy + a
      "copied" flag; `label` = "Share" / "Copy invite link" decided at
      mount; swallow `AbortError` (deliberate dismiss ≠ fall back).
- [ ] 3.2 Both room pages use it for the invite button (replaces the
      inline `copyInviteLink`); keep the `copy-invite-button` testid.
- [ ] 3.3 Verify: with `navigator.share` present the share sheet is
      invoked with the room URL; without it, the link is copied and the
      UI confirms; the shared link opens the same room.

## 4. Tests + polish

- [ ] 4.1 `e2e/` — a portrait phone-viewport spec (JAM room +
      Composition Room): header controls have no overlapping bounding
      boxes, `[data-testid="…-editor"] .cm-content` scrollWidth ≤
      clientWidth after entering a long line, the share/copy affordance
      is present and reachable (via the ⋯ menu at that width).
- [ ] 4.2 Update the existing composition / multi-client e2e that click
      now-collapsed header controls — open the ⋯ menu first at narrow
      widths; desktop-width tests unchanged.
- [ ] 4.3 `nuxt typecheck`, `npm test`, `playwright test` green.

## 5. Ship

- [ ] 5.1 `npm run deploy`; on `https://jaime.stream` check both rooms
      on a real phone (portrait + landscape): no logo overlap, read code
      without sideways scroll, share a link in one tap.

## 6. Spec sync + archive

- [ ] 6.1 `openspec validate add-responsive-rooms --strict`.
- [ ] 6.2 Sync the `responsive-rooms` delta into a new main spec;
      archive the change.
- [ ] 6.3 `docs/04-roadmap/index.md` — note "Phase -1" done; the `@jah`
      roadmap's Phase 0 (`add-oauth-signin`) is next.
