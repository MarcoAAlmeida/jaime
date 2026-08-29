## Why

jaime is pivoting from a single-purpose JAM app to a hub for small
music-oriented tools (`docs/04-roadmap/index.md`). Before any
persistence or domain-model work lands (Phase 2+), the new visual
identity and page structure need to exist as real, live Nuxt UI — not
a throwaway mock — so screens get validated before the aggregates
(User, Pattern, Sample, Composition Room; see
`docs/05-domain-model/index.md`) are built around them.

## What Changes

- Fix `design/tokens/`'s light-mode background token so it resolves to
  the pastel light-beige from `design/assets/jaime-logo.jpg`, not plain
  white. Dark mode's existing `graphite` ramp is already correct.
- Point the deployed Worker at the newly registered `jaime.stream`
  domain as the production URL. **BREAKING**: the site's public URL
  moves off the `*.workers.dev` default.
- Build three real Nuxt layouts: **Landing** (site root, patterned
  after landing-template.nuxt.dev), **Dashboard** (tools shell with
  sidebar nav, patterned after dashboard-template.nuxt.dev), and
  **Docs** (full layout swap for Home + per-technology pages, patterned
  after docs-template.nuxt.dev — likely needs `@nuxt/content`).
- **BREAKING**: Move JAM's create/join screen off the site root and
  into the Dashboard shell as its first tool entry; the site root
  becomes the new marketing landing page instead. Existing room
  IDs/links keep working once at the new entry point — only the entry
  URL moves, not room addressing.
- Add click-through, non-functional mock screens (real Nuxt pages,
  static/mock data, no backend) for every feature that doesn't exist
  yet: Pattern library browse/search, Composition Room (shared editor
  placeholder, presence indicator, viewer-only join mode, empty chat
  panel), and community email-gate/signup.

## Capabilities

### New Capabilities
- `visual-identity`: light/dark-mode design tokens (pastel light-beige
  background, `graphite` dark ramp) applied consistently across every
  shell.
- `landing-page`: the real marketing landing page at the site root.
- `dashboard-shell`: the tools shell — sidebar navigation to Home and
  each tool (Composition Room, then JAM), active-tool highlighting, and
  the full layout swap to the Docs shell when Home is selected.
- `docs-shell`: the Home/docs layout and its per-technology page
  structure (Strudel content itself is out of scope — Phase 5).
- `hub-mock-screens`: non-functional click-through mocks for Pattern
  library, Composition Room, and community signup — placeholders ahead
  of their real implementation phases.

### Modified Capabilities
- `room-lifecycle`: "Landing Page Offers Both Paths" — the create/join
  entry point moves from the site root into the Dashboard shell's JAM
  entry; the site root now serves the new marketing landing page
  instead.
- `frontend-editor`: "Static Deployment" — the deployed build's
  canonical URL moves from the `*.workers.dev` default to the
  `jaime.stream` custom domain.

## Impact

- Affected code: `app/pages/index.vue` and routing (JAM's entry point
  relocates), new pages/layouts for Landing/Dashboard/Docs,
  `design/tokens/`, `nuxt.config.ts` (custom domain / `@nuxt/content`
  if added), deployment config (custom domain routing).
- No persistence, DDD, or backend changes — everything here is
  UI/routing/design only, per `docs/05-domain-model/index.md`'s
  Phase 1 boundary (User, Pattern, Sample, Composition Room's real
  data model all stay out of scope).
- User-facing: anyone with the old `*.workers.dev` URL needs the new
  domain/dashboard route to reach JAM going forward.
