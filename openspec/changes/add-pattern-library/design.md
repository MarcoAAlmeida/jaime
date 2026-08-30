## Context

See proposal.md — Why. Current state that shapes this design:

- The app runs on Nitro's `cloudflare-durable` preset. Realtime room
  state lives in a Durable Object (`server/routes/room.ts`), reached via
  a special `cloudflare:durable:init` hook — not a normal binding.
- There is already **one** D1 database in the project, owned by
  `@nuxt/content` (binding `DB`), used only as its read-only content
  store — populated from a bundled SQL dump, no domain tables. See
  `openspec/changes/archive/2026-08-30-add-tools-hub-visual-identity`.
- Deploy today is a bare `wrangler deploy` (blocked for the agent by the
  sandbox; the user runs it). No migration step exists yet.
- The Strudel/audio engine (`app/lib/audioEngine.ts` — `evaluate`,
  `stop`, `primeAudio`) already exists and is what JAM's room page uses
  for local playback; `/app/jam/room/**` is `ssr: false` to keep that
  browser-only.
- `/app/patterns` is a dashboard-shell page with a hardcoded array and
  client-side filtering (the mock this change replaces).

## Goals / Non-Goals

**Goals:**
- A second D1 database — the Catalog context's — with a
  `wrangler d1 migrations` workflow that fails a deploy rather than
  serving an un-migrated schema.
- One data-access seam (`server/catalog/`) so the Catalog context stays
  separate from the Realtime context.
- The pattern list is queried in D1 (tag filter, text search,
  pagination) — never "fetch all, filter in the browser".

**Non-Goals:**
- Full-text ranking / relevance tuning. `LIKE`-based matching is
  enough for a curated set of this size; FTS5 is a later option.
- A write/authoring API or admin UI. Seeding is a migration; real
  curation is Phase 5.
- `Sample`, pattern→sample references, and loading a pattern into a
  tool — all deferred (proposal.md — Out of scope).
- Reworking the `@nuxt/content` D1 or sharing a database with it.

## Decisions

### 1. A separate D1 database, binding `PATTERNS_DB` (not shared with `@nuxt/content`)

`@nuxt/content`'s `DB` is managed entirely by the content module (dump
+ its own versioning). Putting domain tables in the same database
couples our migrations to the module's lifecycle and risks the module
wiping or rebuilding it. A dedicated database is free on the Workers
plan and keeps the two concerns independent.

*Alternative considered:* one database, separate table prefix —
rejected for the coupling above.

### 2. `wrangler d1 migrations`, files in `migrations/`, applied as an explicit deploy step

Schema lives in `migrations/000N_*.sql`. `wrangler d1 migrations apply
PATTERNS_DB --local` for dev, `--remote` for production. A `deploy` npm
script chains `nuxt build` → `wrangler d1 migrations apply … --remote`
→ `wrangler deploy` so the schema is never behind the code. Local dev
and Playwright use miniflare's auto-provisioned local D1 (same as the
content DB today) with migrations applied against it.

*Alternative considered:* an ORM with its own migration system (Drizzle
etc.) — rejected as premature; `wrangler d1 migrations` is the
first-class tool and the roadmap named it specifically. Raw SQL +
hand-written row mappers for now.

### 3. Schema — a `patterns` table plus a `pattern_tags` join table

```sql
patterns(
  id           TEXT PRIMARY KEY,      -- nanoid
  title        TEXT NOT NULL,
  code         TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  source_author TEXT,                 -- nullable
  created_at   TEXT NOT NULL          -- ISO-8601
)
pattern_tags(
  pattern_id TEXT NOT NULL REFERENCES patterns(id),
  tag        TEXT NOT NULL,
  PRIMARY KEY (pattern_id, tag)
)
```

Tags go in a join table, not a JSON column on `patterns`, so tag
filtering is an indexed `JOIN`/`WHERE tag IN (…)` rather than a
`LIKE '%"tag"%'` scan, and the distinct-tag list (for the filter UI) is
a cheap `SELECT DISTINCT tag`.

*Alternative considered:* `tags TEXT` JSON column — simpler to write,
worse to query; rejected.

### 4. Text search is `LIKE` over title + tags, server-side

`WHERE title LIKE '%q%' OR id IN (SELECT pattern_id FROM pattern_tags
WHERE tag LIKE '%q%')`. Case-insensitive via `LOWER()`. Not `code` —
searching raw Strudel source produces noisy matches. Good enough for
tens-to-hundreds of rows; revisit FTS5 if the catalog grows large.

### 5. API — two Nitro routes under `server/api/`

- `GET /api/patterns?tag=<t>&tag=<t2>&q=<text>&page=<n>&limit=<n>` →
  `{ patterns: Pattern[], page, pageSize, total }`. `limit` capped
  server-side (default 24, max 60). Order: `created_at DESC, id` (stable
  across pages).
- `GET /api/patterns/:id` → `Pattern` or 404.

`Pattern` shape returned to the client: `{ id, title, code, tags: string[],
source: { url, author: string | null }, createdAt }`.

Bindings are read from the h3 event context
(`event.context.cloudflare.env.PATTERNS_DB`) — the normal
binding-access path for this preset, distinct from the DO's init-hook
capture. All D1 access is wrapped in `server/catalog/patterns.ts`
(query builders + row→`Pattern` mappers); routes stay thin.

### 6. `/app/patterns` fetches from the API; preview reuses the audio engine

The page uses `useFetch('/api/patterns', …)` with tag/query/page as
reactive params (server round-trip on change, debounced for text). A
pattern's row expands to show code + attribution + Copy + Preview.
Preview calls into `app/lib/audioEngine.ts` for evaluation and stop;
evaluation errors render inline (same pattern as the room page's
per-track error).

`audioEngine.ts` today is track-keyed (JAM's four tracks) and
**registers only the built-in synth waveforms — no sample banks**, a
deliberate choice to avoid a network dependency in JAM. A curated
library, though, mostly contains sample-based patterns (`s("bd hh")`
etc.), and the spec requires preview to actually play. So the preview
path adds two things to `audioEngine.ts`: a dedicated non-track preview
repl (`evaluatePreview(code)` / `stopPreview()`), and a one-time
`samples()` load of Strudel's default sample bank
(`github:tidalcycles/dirt-samples`, what strudel.cc uses) triggered on
first preview. JAM's engine path is untouched — it still never loads
samples.

The route **stays SSR** — the list renders server-side from the same
API, so patterns are shareable and crawlable. The Strudel/audio bundle
(~1.7MB) is **not** pulled in at load: `app/lib/audioEngine.ts` is
dynamically `import()`ed inside the preview handler, on first preview
only. So browsing and searching never touch that weight.

### 7. Seed data — a migration, ~20 hand-picked patterns

`migrations/0002_seed_patterns.sql` with `INSERT` statements for ~20
patterns drawn from awesome-strudel and a few originals, each with a
real `source_url`. Committed, runs once. This doubles as the fixture
the tests assert against.

## Risks / Trade-offs

- **Migration step forgotten on deploy → 500s against an un-migrated
  schema.** → The `deploy` npm script chains migrations before
  `wrangler deploy`; document that `wrangler deploy` alone is no longer
  the deploy command. A startup check that the expected table exists
  can return a clear 503 instead of a raw error.
- **Two local D1 databases in dev (content + patterns).** → Both are
  miniflare-managed and auto-provisioned; the only extra step is
  applying our migrations locally, wrapped in the `dev`/pretest flow.
- **`LIKE '%q%'` can't use an index; full scan per search.** →
  Acceptable at this scale (curated, tens–low-hundreds). FTS5 is the
  known upgrade path and doesn't change the API.
- **Preview loads the ~1.7MB Strudel bundle.** → Lazy `import()` on
  first preview only; the list and search never touch it.
- **`ssr: false` on the list would hurt shareability/SEO.** → Keep the
  list SSR (data from the same API server-side), load audio lazily —
  don't blanket-disable SSR for the whole route.

## Migration Plan

1. `wrangler d1 create jaime-patterns` (user runs; agent's API write is
   sandbox-blocked). Add the `PATTERNS_DB` binding to `wrangler.jsonc`.
2. Add `migrations/0001_init.sql` (tables) and
   `migrations/0002_seed_patterns.sql` (seed rows).
3. Add the `deploy` npm script (build → `d1 migrations apply --remote`
   → `wrangler deploy`) and a `db:migrate:local` helper used by `dev`
   and the Playwright pretest.
4. Build `server/catalog/patterns.ts` + the two API routes + unit tests
   (pool-workers, against local D1 with the seed migration applied).
5. Rebuild `app/pages/app/patterns.vue` against the API; drop the
   `Soon` badge in `app/utils/tools.ts`.
6. Single deploy via the new `deploy` script; verify on `jaime.stream`.

**Rollback:** the change is additive — a new database, new routes, one
rewritten page. Reverting the commit and redeploying restores the mock;
the unused `jaime-patterns` database can be left or deleted. No data
migration of existing user content is involved.
