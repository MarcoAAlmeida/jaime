## Why

The Pattern library is a click-through mock today (`/app/patterns`,
static array, `hub-mock-screens` spec). Turning it real is the first
slice of roadmap Phase 2 — it forces the persistence foundation the
rest of the roadmap needs (a durable, cross-request store with
version-controlled schema, distinct from per-room Durable Object
storage) while delivering a visible feature: somewhere to find a
Strudel starting point instead of a blank editor.

## What Changes

- Introduce a **Cloudflare D1 database** for the Catalog bounded
  context, managed with `wrangler d1 migrations` (versioned,
  source-controlled schema — the stated hard requirement). This is the
  app's first domain-persistence layer; the existing D1 used by
  `@nuxt/content` stays separate.
- Add the **`Pattern`** aggregate (Catalog context): `id`, `title`,
  `code`, `tags[]`, `source` (attribution `{ url, author? }`),
  `createdAt`. No `sampleIds` yet (Sample is deferred to Phase 3, when
  sample playback exists); no owner/maintainer field (curation is a
  Phase 5 authoring process, not a modeled relationship).
- Seed ~20 hand-picked patterns (some from
  [awesome-strudel](https://github.com/terryds/awesome-strudel)) as
  committed seed data applied via a migration. A full awesome-strudel
  import is Phase 5's Claude-assisted authoring work, not this change.
- Add a **read-only pattern-library API**: list with server-side tag
  filter + text search + pagination, and fetch one pattern. Backed by
  D1 queries, not client-side filtering of a full dump.
- Rebuild `/app/patterns` against the real API: browse the curated
  list, filter by tag, search by text, view a pattern's code and its
  attribution, copy the code, and **preview** it (running `code`
  client-side).
- **Out of scope, deliberately:** loading a pattern into JAM or any
  other tool. It's wanted (user stories 43), but it touches the
  realtime tools and belongs in a later phase — this change stops at
  the library being real, searchable, and previewable.
- **BREAKING (mock removal):** the `hub-mock-screens` "Pattern Library
  Mock" requirement is dropped; `/app/patterns` is no longer a mock.

## Capabilities

### New Capabilities
- `pattern-library`: the durable, curated catalog of Strudel patterns
  — what a Pattern is, that the catalog survives deploys, that it's
  browsable and server-side searchable/filterable by tag and text with
  pagination, that each pattern carries its source attribution, and
  that a pattern can be previewed as sound before use.

### Modified Capabilities
- `hub-mock-screens`: remove the "Pattern Library Mock Shows Example
  Patterns" requirement — the Pattern library is now a real feature
  (`pattern-library`), no longer a mock. The Composition Room and
  community signup mock requirements are unchanged.

## Impact

- **New dependency / infra:** a D1 database binding (separate from
  `@nuxt/content`'s), a `migrations/` directory, `wrangler.jsonc`
  updates, and the migrations step in the deploy flow.
- **New code:** `server/` API routes for the pattern-library read
  endpoints; a Catalog-context data-access module; a seed migration.
- **Changed code:** `app/pages/app/patterns.vue` (mock → real, data
  from the API); `app/utils/tools.ts` (drop the "Soon" badge on
  Patterns).
- **Specs:** new `pattern-library`; `hub-mock-screens` loses one
  requirement.
- **Not touched:** JAM room protocol, Composition Room, `User` /
  identity, `@nuxt/content` / docs.
