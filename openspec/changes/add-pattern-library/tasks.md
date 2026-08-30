## 1. D1 database + migrations workflow

- [x] 1.1 Create the `jaime-patterns` D1 database
      (`wrangler d1 create jaime-patterns` — done, id
      `81156163-fc4b-4828-96b5-7f954678ac19`) and add the `PATTERNS_DB`
      binding to `wrangler.jsonc` with `migrations_dir: migrations/patterns`,
      separate from `@nuxt/content`'s `DB`
- [x] 1.2 Add `migrations/patterns/0001_init.sql` — the `patterns` and
      `pattern_tags` tables per design.md decision 3, with the
      `pattern_tags(tag)` index and a `patterns(created_at DESC, id)`
      listing index
- [x] 1.3 Added npm scripts: `db:migrate:local` / `db:migrate:remote`,
      and `deploy` → `scripts/deploy.mjs` (build → `d1 migrations apply
      --remote` with `CI=1` so the confirm prompt doesn't halt the
      chain → `wrangler deploy`). `dev`, `test`, `test:e2e` run
      `db:migrate:local` first. Added the `npm run deploy` rule to
      `AGENTS.md`. Verified `db:migrate:local` applies `0001` cleanly.
- [x] 1.4 Ran `wrangler types` — `PATTERNS_DB: D1Database` is now in the
      ambient `Env` in `worker-configuration.d.ts`

## 2. Seed data

- [x] 2.1 Added `migrations/patterns/0002_seed_patterns.sql` — 20
      curated patterns (mostly synth so preview works, plus a few
      dirt-sample drum/breaks ones), slug ids, real `strudel.cc` /
      awesome-strudel `source_url`, 2–4 tags each
- [x] 2.2 `db:migrate:local` applies `0001` + `0002` cleanly; local D1
      has 20 patterns, 53 tag rows, 26 distinct tags

## 3. Catalog data-access module

- [x] 3.1 `server/catalog/patterns.ts`: `Pattern` type + `rowToPattern`
      mapper (assembles `tags[]` and nested `source`); `isMigrated()`
      helper for 4.3
- [x] 3.2 `listPatterns({ tags, q, page, limit })` — server-side tag
      filter via the join table (AND across multiple tags), `LIKE` text
      search over title + tags (`lower()`), `created_at DESC, id`
      order, offset pagination; `{ patterns, page, pageSize, total }`;
      `limit` clamped (default 24, max 60), `page` clamped ≥ 1
- [x] 3.3 `getPattern(id)` — one `Pattern` or `null`
- [x] 3.4 `listTags()` — distinct tags, sorted
- [x] 3.5 `test/patterns-catalog.test.ts` (pool-workers; migrations
      applied by `test/apply-migrations.ts` + the async `vitest.config.ts`):
      12 tests — pagination covers every seed once, stable order, limit
      clamp, single-tag narrow + count, multi-tag AND, unmatched tag →
      empty page, text search on title and tag, text+tag combine, full
      shape, `getPattern` hit + `null` miss, `listTags` distinct/sorted.
      Full suite 39/39.

## 4. Read API

- [x] 4.1 `server/api/patterns/index.get.ts` — parses `tag` (repeatable),
      `q`, `page`, `limit`; `PATTERNS_DB` via
      `server/utils/patternsDb.ts` (`usePatternsDb` — reads
      `event.context.cloudflare.env`, works in dev / prod / pool-workers);
      returns the `listPatterns` envelope
- [x] 4.2 `server/api/patterns/[id].get.ts` — `Pattern` or
      `createError({ statusCode: 404 })`. Also
      `server/api/patterns/tags.get.ts` for the filter list (static
      segment wins over `[id]`)
- [x] 4.3 `assertPatternsMigrated()` in `server/utils/patternsDb.ts` —
      every route checks `isMigrated()` and throws a 503 "catalog
      database has not been migrated" instead of a raw error
- [x] 4.4 `test/patterns-api.test.ts` (9 tests, `SELF.fetch`): list
      envelope + shape, limit/page, repeated-tag AND filter, unmatched
      tag → empty page, text search, q+tag combine, `/tags` distinct
      sorted, `/:id` 200 and 404. Full suite 48/48.

## 5. Rebuild `/app/patterns`

- [x] 5.1 `app/pages/app/patterns.vue` rebuilt: `useFetch('/api/patterns')`
      with `{ tag: string[], q, page, limit }` reactive query (SSR-first,
      re-fetches on change); text box debounced 250ms → `q`; tag/query
      change resets to page 1; `UPagination` when `total > 24`
- [x] 5.2 Multi-select tag chips (AND filter) from
      `GET /api/patterns/tags`
- [x] 5.3 Row expands in place → code block, inline error slot, Preview,
      Copy code (with "Copied" confirmation), and a source link
      (author, or the host)
- [x] 5.4 `app/lib/audioEngine.ts` gains `evaluatePreview` / `stopPreview`
      on a dedicated non-track repl + one-time
      `samples('github:tidalcycles/dirt-samples')` load; JAM's path
      untouched. Page dynamically `import()`s the engine on first
      preview, stops any prior preview, shows eval errors inline, one at
      a time; stops on unmount
- [x] 5.5 Loading / error / empty states + "No patterns match that
      filter"; a "Clear" control when a filter is active
- [x] 5.6 Dropped the `Soon` badge on Patterns in `layouts/dashboard.vue`
      (it was there, not in `tools.ts`); removed the "mock (Phase 4)"
      navbar badge
- [x] 5.7 Old mock array and "this is a preview" alert gone (page fully
      rewritten)

## 6. Verification + deploy

- [x] 6.1 `nuxt typecheck` clean; `vitest run` 48/48 (21 new);
      `playwright test` 11/11 against a running `wrangler dev` with
      migrations applied
- [x] 6.2 Verified every `specs/pattern-library/spec.md` scenario
      against `wrangler dev`: field shape + unknown-id 404 (API tests +
      screenshot), paginated list covering every pattern once (tests),
      tag filter narrows + empty page for an unmatched tag (screenshot +
      tests), text search + combined text/tag (tests), attribution
      shown with the code (screenshot), preview plays (button → Stop),
      a deliberately broken pattern surfaces its error inline. "Persists
      across deploys" / "migrations in order" confirmed by mechanism;
      final check is 6.3.
- [x] 6.3 Deployed (version `90820da0`). Remote `PATTERNS_DB` migrated
      (`0001` + `0002`, 20 rows). Verified live on `jaime.stream`:
      `/api/patterns` (total 20, pagination, DESC order),
      `/api/patterns/tags` (26 distinct), repeated-tag AND filter,
      `?q=acid`, `/:id` 200 + `nope` 404, `/app/patterns` 200. Deploy
      script hardened afterwards (`scripts/deploy.mjs`) so the remote
      migration prompt can't break the chain again.
