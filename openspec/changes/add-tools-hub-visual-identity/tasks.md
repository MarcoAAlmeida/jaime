## 1. Visual identity

- [ ] 1.1 Fix `design/tokens/`'s light-mode `--ui-bg` to resolve to
      pastel light-beige (per `design/assets/jaime-logo.jpg`), not
      white
- [ ] 1.2 Verify dark mode's `graphite` ramp still resolves correctly
      after the light-mode fix (no regression)

## 2. Production domain

- [ ] 2.1 Add `jaime.stream` as a Cloudflare custom domain for the
      Worker
- [ ] 2.2 Add a redirect from the `*.workers.dev` default URL to
      `jaime.stream`
- [ ] 2.3 Confirm the deployed build at `https://jaime.stream` works
      identically to local `wrangler dev`

## 3. Layout shells

- [ ] 3.1 Add `@nuxt/content` and configure it for the Docs shell's
      page structure
- [ ] 3.2 Build the Landing layout (`layouts/landing.vue`), patterned
      after landing-template.nuxt.dev
- [ ] 3.3 Build the Dashboard layout (`layouts/dashboard.vue`) with
      persistent sidebar, patterned after dashboard-template.nuxt.dev
- [ ] 3.4 Build the Docs layout (`layouts/docs.vue`) with nav tree,
      patterned after docs-template.nuxt.dev

## 4. Landing page (`/`)

- [ ] 4.1 Build the landing page: value-proposition heading, tools
      list (Composition Room before JAM), one primary CTA into JAM,
      link to `/docs`, link to `/signup`
- [ ] 4.2 Add the returning-visitor fast path to `/app` from the
      landing page

## 5. Dashboard shell + JAM re-route

- [ ] 5.1 Build the dashboard sidebar: Home, Composition Room, JAM (in
      that order), with active-tool highlighting
- [ ] 5.2 Wire tool switching to navigate without a full shell reload
- [ ] 5.3 Wire the Home sidebar entry to fully swap to the Docs layout
      (not nested inside dashboard chrome)
- [ ] 5.4 Move JAM's create/join page to `/app/jam`; move the active
      room page to `/app/jam/room/[id]` (same components, new paths —
      room addressing/protocol unchanged)
- [ ] 5.5 Add `/app` → `/app/jam` redirect
- [ ] 5.6 Update `e2e/multi-client.spec.ts` and
      `scripts/room-load-check.mjs` for the new JAM routes

## 6. Docs shell (`/docs`)

- [ ] 6.1 Build the Docs Home page and nav tree
- [ ] 6.2 Add a placeholder Strudel section page (`/docs/strudel`),
      reachable from the nav tree, content deferred to Phase 5
- [ ] 6.3 Add the path back to the dashboard from the docs shell

## 7. Mock screens

- [ ] 7.1 Build the Pattern library mock (`/app/patterns`): static list
      of example patterns with tags, no real search
- [ ] 7.2 Build the Composition Room mock (`/app/composition-room`):
      placeholder editor, mock presence indicator, viewer/editor
      toggle, empty chat panel
- [ ] 7.3 Build the community signup mock (`/signup`): email field,
      submit acknowledgment, explicit "coming soon" messaging, no real
      email sent

## 8. Verification

- [ ] 8.1 Manually verify every scenario in
      `specs/visual-identity/spec.md`,
      `specs/landing-page/spec.md`,
      `specs/dashboard-shell/spec.md`,
      `specs/docs-shell/spec.md`, and
      `specs/hub-mock-screens/spec.md`
- [ ] 8.2 Run the existing JAM e2e suite against the new `/app/jam`
      routes and confirm it still passes end to end
