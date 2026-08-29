## Context

See proposal.md - Why. jaime today is a single Nuxt app with JAM at
`/` (create/join) and `/room/[id]` (active room) — no other pages
exist. This phase adds three real Nuxt layouts and several new/mocked
pages around that existing app without touching JAM's realtime
protocol. Real Nuxt UI is required here, not a throwaway prototype —
an earlier React/JSX design-system mock was tried and abandoned as
disconnected from the actual Nuxt app.

## Goals / Non-Goals

**Goals:**
- Three genuine Nuxt layouts (Landing, Dashboard, Docs), each a real
  `layouts/*.vue`, selected per-page — not composed or conditionally
  nested.
- JAM actually re-routed to live inside the Dashboard shell (per
  explicit decision — this phase touches production routing, not just
  new pages).
- `jaime.stream` wired as the canonical production domain.
- Non-functional mock pages (Pattern library, Composition Room,
  community signup) as real routed Vue pages with static/mock data.

**Non-Goals:**
- No persistence, no DDD/aggregate implementation — User, Pattern,
  Sample, and the Room variants stay conceptual per
  `docs/05-domain-model/index.md`.
- No real email sending/confirmation — Cloudflare Email Sending stays
  disabled per `docs/06-user-stories/index.md` Journey 1 story 5.
- No Strudel/Hydra/TidalCycles docs content — only the shell/structure
  and a placeholder Strudel nav entry (content is Phase 5).
- No real collaborative editing for Composition Room — mock only.
- No changes to JAM's realtime protocol or existing capabilities
  (`realtime-room`, `track-ownership`, `transport-clock`, `presence`,
  `room-persistence`) beyond the routing/domain deltas already in
  `specs/`.

## Decisions

1. **Route map** (new, since specs deliberately describe behavior, not
   URLs):
   - `/` → Landing page (new)
   - `/app` → Dashboard shell root; redirects to `/app/jam` (the only
     real functional tool right now — Composition Room's mock isn't a
     meaningful default landing view)
   - `/app/jam` → JAM create/join (dashboard-shell entry; satisfies the
     modified `room-lifecycle` requirement)
   - `/app/jam/room/:id` → active JAM room (existing component, new
     path prefix — room addressing itself is unchanged)
   - `/app/composition-room` → Composition Room mock
   - `/app/patterns` → Pattern library mock
   - `/signup` → community signup mock (kept outside the dashboard
     shell — it's reachable from Landing and doesn't need sidebar
     chrome)
   - `/docs`, `/docs/strudel`, … → Docs shell Home and per-technology
     pages (full layout swap, not under `/app`)

2. **`@nuxt/content` for the Docs shell.** Needed now, even with no
   real content yet, so the nav-tree/page conventions are established
   before Strudel docs get authored (Phase 5) — switching to it later
   would mean reworking the shell. Alternative considered: plain Vue
   pages without `@nuxt/content`; rejected because
   docs-template.nuxt.dev's structure assumes content collections, and
   deferring the dependency just delays the same work.

3. **Mock screens are static components, no store.** Pattern library,
   Composition Room, and signup mocks use hardcoded data — no Pinia
   store, no API calls. Alternative considered: a fake in-memory store
   to ease the later swap to real data; rejected as premature
   abstraction for what's a one-phase, throwaway-data mock (Phase 2+
   builds the real thing against D1, not this).

4. **`*.workers.dev` redirects to `jaime.stream`, rather than being
   disabled outright.** Preserves anything that might already be
   pointing at the default URL during the transition, consistent with
   the modified `frontend-editor` requirement's new canonical URL.

## Risks / Trade-offs

- [Risk] Moving JAM off `/` could break bookmarks/links expecting JAM
  directly at the root → [Mitigation] No established user base yet
  (pre-launch); `/`'s primary CTA still reaches JAM in one click.
- [Risk] `@nuxt/content` adds a new dependency and a content-collection
  build step before there's real content to manage → [Mitigation]
  Scoped to the Docs shell only; Dashboard/Landing don't depend on it.
- [Risk] A visitor could mistake a non-functional mock (e.g. the
  signup form) for a working feature → [Mitigation] Mock screens show
  explicit "coming soon"/placeholder acknowledgment text rather than
  silently pretending success.

## Migration Plan

- Point `jaime.stream` at the existing Worker as a Cloudflare custom
  domain; add a redirect from `*.workers.dev` rather than disabling it,
  so nothing 404s mid-transition.
- Ship the route changes (JAM moving under `/app/jam`) and the new
  Landing/Dashboard/Docs shells in a single deploy — no gradual
  rollout needed, since this is pre-launch with no real user base.
- No data migration — this phase touches no persisted state.
