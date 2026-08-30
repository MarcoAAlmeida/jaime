## 1. Visual identity

- [x] 1.1 Fix `design/tokens/`'s light-mode `--ui-bg` to resolve to
      pastel light-beige (per `design/assets/jaime-logo.jpg`), not
      white — added `--beige-bg:rgb(245,240,229)` to `palette.css`,
      pointed light-mode `--ui-bg` at it in `colors.css`, and wired
      `design/styles.css` into the app via `app/assets/css/main.css`
      (the app previously applied none of the design tokens)
- [x] 1.2 Verify dark mode's `graphite` ramp still resolves correctly
      after the light-mode fix (no regression) — dark `--ui-bg` →
      `--neutral-900` → `--graphite-900` (`#191817`, warm near-black,
      no navy); confirmed in the production CSS bundle from `nuxt build`
- [x] 1.3 Wire the palette into @nuxt/ui v4 properly (visual review
      turned up the gap): the design tokens only covered the neutral /
      surface roles, so buttons/links/focus stayed @nuxt/ui's default
      green + blue-link. Fix: `app/assets/css/main.css` `@theme`
      registers `jaimeblue` + `graphite` ramps (from `palette.css`),
      `app/app.config.ts` sets `ui.colors.primary: 'jaimeblue'` /
      `neutral: 'graphite'`; stopped importing `design/tokens/base.css`
      (its unlayered global `a{}`/`body{}` rules were overriding
      @nuxt/ui) — kept only `palette.css` + `colors.css` + an explicit
      body-font rule.
- [x] 1.4 Fix the JAM room going dark on entry — `@strudel/codemirror`'s
      `initEditor` force-adds `.dark` to `<html>` to match its editor
      theme, which was dragging the whole app into dark mode.
      `TrackEditor.vue` now re-asserts the real color mode after
      `initEditor`. Also dropped the `opacity-50` on unclaimed-track
      editors — it turned the (dark) editor to mud over the beige page.
- [x] 1.5 Second visual review: brand primary is now **rust**
      (`#b25e2f`, `--rust-*` ramp in `palette.css`) not blue — the
      earlier blue was a placeholder from the .fig. `colors.css`
      `--primary-*` points at `--rust-*`; `@theme` + `app.config.ts`
      register it for @nuxt/ui. Plain nav/footer links decoupled from
      the brand color (`color="neutral"` on `UNavigationMenu`) — rust
      is reserved for buttons and real accents.

## 2. Production domain

- [x] 2.1 Add `jaime.stream` as a Cloudflare custom domain for the
      Worker — declared in `wrangler.jsonc`
      (`routes: [{ pattern: "jaime.stream", custom_domain: true }]`);
      attached on `wrangler deploy` (version
      `51c8c5ab-fb4c-4ea8-a509-72d01559704d`). `https://jaime.stream`
      is live and serving.
- [x] 2.2 Add a redirect from the `*.workers.dev` default URL to
      `jaime.stream` — `server/middleware/workers-dev-redirect.ts`
      301s any `*.workers.dev` host to the same path+query on
      `jaime.stream`; `workers_dev: true` kept in `wrangler.jsonc` so
      the old URL stays reachable to redirect. Verified in the workerd
      runtime by `test/workers-dev-redirect.test.ts` (3 tests).
- [x] 2.3 Confirm the deployed build at `https://jaime.stream` works
      identically to local `wrangler dev` — verified post-deploy:
      `/`, `/app/jam`, `/app/jam/room/:id`, `/docs`, `/docs/strudel`,
      `/app/patterns`, `/app/composition-room`, `/signup` all 200;
      `/docs` renders content from D1; `/app` → `/app/jam` and legacy
      `/room/:id` → `/app/jam/room/:id` redirect; the `*.workers.dev`
      URL 301s to `jaime.stream`.

## 3. Layout shells

- [x] 3.1 Add `@nuxt/content` and configure it for the Docs shell's
      page structure — `@nuxt/content` v3 added (after `@nuxt/ui`),
      `content.config.ts` defines a `docs` page collection sourced from
      `content/docs/**`. NOTE: content's Cloudflare preset forces a D1
      database (binding `DB`) as its read-only content store — see
      design deviation note below.
- [x] 3.2 Build the Landing layout (`app/layouts/landing.vue`) —
      `UHeader` / `UMain` / `UFooter`, patterned after
      landing-template.nuxt.dev
- [x] 3.3 Build the Dashboard layout (`app/layouts/dashboard.vue`) —
      `UDashboardGroup` + collapsible/resizable `UDashboardSidebar`,
      patterned after dashboard-template.nuxt.dev
- [x] 3.4 Build the Docs layout (`app/layouts/docs.vue`) — after visual
      review, rebuilt on `UDashboardGroup` + collapsible/resizable
      `UDashboardSidebar` (same UX as the dashboard shell) with the doc
      sections as nav items + a "Back to tools" entry; distinct layout,
      distinct nav, shared chrome behaviour. Docs pages render in a
      `UDashboardPanel`.

## 4. Landing page (`/`)

- [x] 4.1 Build the landing page (`app/pages/index.vue`,
      `layout: landing`): `UPageHero` value proposition, `UPageSection`
      #tools grid from `app/utils/tools.ts` (Composition Room before
      JAM), one primary "Try JAM" CTA, "Read the docs" → `/docs`,
      `UPageCTA` → `/signup`
- [x] 4.2 Add the returning-visitor fast path — when `useDisplayName`
      has a stored name, the hero shows a "Welcome back" alert linking
      straight to `/app/jam`

## 5. Dashboard shell + JAM re-route

- [x] 5.1 Build the dashboard sidebar: Home, Composition Room, JAM (in
      that order) via `UNavigationMenu`; active tool highlighted for
      its whole route subtree
- [x] 5.2 Tool switching is `NuxtLink` client-side nav; the dashboard
      layout stays mounted across `/app/jam`, `/app/patterns`,
      `/app/composition-room`
- [x] 5.3 The Home sidebar entry links to `/docs`, which uses the
      separate `docs` layout — a full chrome swap, not nested
- [x] 5.4 Moved JAM's create/join page to `app/pages/app/jam/index.vue`
      (`/app/jam`, dashboard layout); `git mv`'d the room page to
      `app/pages/app/jam/room/[id].vue` (`layout: false`, unchanged
      components). WS route `/room?id=` and the protocol are untouched.
      `routeRules` `/app/jam/room/**` gets `ssr: false`.
- [x] 5.5 Add `/app` → `/app/jam` redirect — `routeRules` for
      server-side + `app/pages/app/index.vue` for client-side nav.
      Also redirected legacy `/room/**` → `/app/jam/room/**`.
- [x] 5.6 Updated `e2e/multi-client.spec.ts` (goto `/app/jam`, room URL
      regex `/\/app\/jam\/room\//`) and `scripts/room-load-check.mjs`
      (usage note: WS route unchanged, example URL → `jaime.stream`)

## 6. Docs shell (`/docs`)

- [x] 6.1 Build the Docs Home page (`app/pages/docs/index.vue`,
      `content/docs/1.index.md`) and the nav tree (from
      `queryCollectionNavigation` in `layouts/docs.vue`)
- [x] 6.2 Add the placeholder Strudel section (`/docs/strudel`,
      `content/docs/2.strudel.md`, `placeholder: true` → renders a
      "content coming in a later phase" alert), reachable from the nav
      tree; catch-all `app/pages/docs/[...slug].vue`
- [x] 6.3 Path back to the dashboard from the docs shell — "Back to
      tools" header button + footer link, both → `/app/jam`

## 7. Mock screens

- [x] 7.1 Build the Pattern library mock (`/app/patterns`): static list
      of 6 example patterns with tags + mock-only client-side filter,
      explicit "Mock — Phase 4" / "this is a preview" messaging
- [x] 7.2 Build the Composition Room mock (`/app/composition-room`):
      placeholder read-only editor, mock `UAvatarGroup` presence
      indicator, editor/viewer toggle (viewer shows a "Read only"
      lock), empty chat panel with a disabled input
- [x] 7.3 Build the community signup mock (`/signup`): email field,
      submit acknowledgment that names the address but states nothing
      was sent or saved, explicit "Coming soon" alert

## 8. Verification

- [ ] 8.1 Manually verify every scenario in
      `specs/visual-identity/spec.md`,
      `specs/landing-page/spec.md`,
      `specs/dashboard-shell/spec.md`,
      `specs/docs-shell/spec.md`, and
      `specs/hub-mock-screens/spec.md`
- [x] 8.2 Run the existing JAM e2e suite against the new `/app/jam`
      routes and confirm it still passes end to end — 11/11
      `e2e/multi-client.spec.ts` pass against `wrangler dev`; 27/27
      unit tests pass; `nuxt typecheck` clean

## Design deviation — @nuxt/content requires D1

design.md Decision 2 committed to `@nuxt/content` but assumed "no
backend changes". On the Cloudflare preset, `@nuxt/content` v3
*requires* a D1 database (it hardcodes binding `DB`) as the store its
bundled content dump is loaded into at runtime. This is read-only
content storage, not the app's domain persistence (User/Pattern schema
+ migrations remain Phase 2), but it does mean Phase 1 introduces a D1
binding. A `jaime-content` D1 database was created
(`7c4710fd-b9a1-4a91-a187-58144c311d12`) and wired in `wrangler.jsonc`.
Local dev / e2e use a miniflare-local D1 (no remote dependency).
