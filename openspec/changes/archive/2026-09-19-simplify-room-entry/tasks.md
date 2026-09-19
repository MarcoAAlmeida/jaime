## 1. Nickname suggestion

- [x] 1.1 Add `app/lib/suggestedName.ts` exporting `randomDisplayName(): string`
      (small local adjective + creature/object word lists, no new dependency)
- [x] 1.2 Composition Room (`app/pages/app/composition/[id].vue`):
      initialize `nameInput` with `randomDisplayName()` instead of `''`
- [x] 1.3 JAM room (`app/pages/app/jam/room/[id].vue`): same, initialize
      `nameInput` with `randomDisplayName()`

## 2. Drop the editor/viewer choice from Composition Room's join gate

- [x] 2.1 Remove the `!role` gate's "Editor"/"Viewer" buttons from the
      template
- [x] 2.2 On mount (alongside the existing name-gate flow), call
      `chooseRole('editor')` automatically, unless `route.query.role
      === 'viewer'`, in which case call `chooseRole('viewer')` instead
- [x] 2.3 Confirm `chooseRole`, `Role`, `isEditor`, and every
      `v-if="isEditor"` / server-side role check are otherwise
      untouched — this only changes what triggers the choice, not the
      role machinery itself

## 3. Composition Room: seed from a library pattern via `?load=`

- [x] 3.1 In `async start()`, where `STARTER_DOC` is inserted for a
      brand-new room, first check `route.query.load`: if present,
      fetch `/api/patterns/:id`, catching a failed fetch back to
      `STARTER_DOC`
- [x] 3.2 After seeding from `?load=`, strip it from the URL
      (`router.replace({ query: {} })` or equivalent) so the address
      bar and any copied invite link stay clean
- [x] 3.3 Pattern Library (`app/pages/app/patterns.vue`): add "Load
      into Composition Room" next to "Load into JAM", calling
      `navigateTo('/app/composition/${nanoid(10)}?load=${encodeURIComponent(pattern.id)}')`

## 4. Update e2e tests for the removed buttons

- [x] 4.1 `e2e/composition.spec.ts`'s `joinRoom` helper: for
      `role === 'editor'` (default), stop clicking `role-editor` —
      nothing to click. For `role === 'viewer'`, navigate to
      `?role=viewer` instead of clicking `role-viewer`
      (also fixed two inline `role-editor` clicks outside the helper,
      in the "sidebar links to the real room" test)
- [x] 4.2 Verify the "a viewer cannot edit the document" test still
      passes using the `?role=viewer` path — confirms real enforcement
      stays covered, not just a stub
- [x] 4.3 `e2e/mobile-rooms.spec.ts`: remove the three
      `role-editor` click steps (lines ~68, ~107, ~159) — editor is now
      the default, no button to click
- [x] 4.4 Grep the repo for any other `role-editor` / `role-viewer`
      references and update them the same way
      (found and fixed two more active call sites beyond the tasks
      list's own estimate: e2e/oauth.spec.ts and e2e/ascii-panel.spec.ts)

## 5. Verify and deploy

- [x] 5.1 Typecheck (`vue-tsc --noEmit`) and run the full composition
      + mobile-rooms + pattern-loading e2e suites
      (also re-ran oauth.spec.ts and ascii-panel.spec.ts, since both
      were edited for the role-gate removal; 28/28 passing. Along the
      way, found and fixed a real, pre-existing bug unrelated to this
      change's own scope: `/app/jam/room/**` and `/app/composition/**`
      are `ssr:false` [nuxt.config.ts, added by add-ascii-overlay,
      after add-oauth-signin], so the SSR-only auth plugin never ran
      for a signed-in user hard-navigating straight to a room link —
      they wrongly saw the name-entry gate. Fixed with a client-side
      `refreshAuth()` fallback in both room pages' `onMounted`.)
- [x] 5.2 Browser-verify: creating a Composition Room lands you
      straight in as editor (no role prompt); opening a room's plain
      link also lands as editor; `?role=viewer` still works and is
      genuinely read-only; the name prompt arrives pre-filled with a
      suggested name on both JAM and Composition Room, editable, and
      Enter submits it; "Load into Composition Room" opens a new room
      seeded with the right code and a clean URL
      (verified live via Playwright MCP: signed-in user lands straight
      in on a fresh/direct link with no gate at all; anon gets a
      pre-filled suggested name, Enter submits, lands straight in as
      editor; `?role=viewer` shows a read-only room with no Play
      button; "Load into Composition Room" from the pattern library
      opened a new room pre-seeded with Dinofunk's code and a
      query-free URL)
- [x] 5.3 `npm run deploy` (version `59dec85e-1347-481d-a27c-aa82bef45594`,
      live at jaime.stream)
