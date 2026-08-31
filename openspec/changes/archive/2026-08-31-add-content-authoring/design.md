## Context

See `proposal.md` — Why. Current state:

- Curated patterns are ~20 rows in `migrations/patterns/0002_seed_patterns.sql`
  (`seed-*` ids). Schema (`0001`): `patterns(id, title, code, source_url,
  source_author, created_at)` + `pattern_tags(pattern_id, tag)`. No column
  distinguishes curated rows from anything else — there is nothing else yet.
- `scripts/deploy.mjs` runs `nuxt build` → `wrangler d1 migrations apply
  PATTERNS_DB --remote` → `wrangler deploy`. `db:migrate:local` applies
  migrations `--local` and is wired into `dev` / `test` / `test:e2e`.
- The `/app/patterns` page and `/api/patterns*` read D1 at runtime via the
  `PATTERNS_DB` binding — the manifest is an authoring input, not a runtime
  source.
- Docs: `content/docs/{1.index,2.strudel,9.behind-the-scenes}.md`, one flat
  file per section, `@nuxt/content` `docs` collection. `2.strudel.md` has
  `placeholder: true`; `docs.vue` renders `navigation[0].children` as a flat
  nav.

## Goals / Non-Goals

**Goals:**

- Curated catalog is editable as reviewable data (one pattern per file),
  not SQL, and a deploy makes the database match it exactly.
- Reconcile is idempotent and never touches non-curated rows.
- Local dev and tests run against the same curated catalog as production.
- First real batch of awesome-strudel patterns + real Strudel docs land on
  this mechanism.

**Non-Goals:**

- No runtime read of the manifest by the Nuxt app (D1 stays the source of
  truth at request time).
- No in-app authoring UI, no write API (`domain-model` decision 7).
- No docs full-text search, no Hydra/TidalCycles pages (separate change).
- No change to `/api/patterns*` shape or the `/app/patterns` UI.

## Decisions

### 1. Manifest = one Markdown file per pattern under `content/patterns/`

`content/patterns/<id>.md`: YAML frontmatter (`title`, `tags`,
`source_url`, `source_author?`) and the Strudel code as the file body in a
fenced ```` ```strudel ```` block.

- **Why per-file Markdown over one JSON array:** clean diffs and blame per
  pattern; code is not JSON-escaped; a reviewer reads the actual snippet;
  merge conflicts stay local to one pattern. The body-as-code-fence keeps
  multi-line snippets readable (no YAML block scalars).
- **Why not a `@nuxt/content` collection:** the app does not read these;
  adding a collection couples build-time authoring data to the runtime
  content pipeline for no gain. The sync script parses frontmatter itself
  (a tiny dependency-free splitter, or `gray-matter` if already transitively
  present).
- `id` is the filename stem, kept in the `seed-*` convention for the rows
  migrated out of `0002`; new ones get readable slugs too.
- A `description` frontmatter field is allowed and ignored for now (room for
  story 48's docs↔pattern context later without a format change).

### 2. Add an `origin` column to mark curated rows

Migration `0004_pattern_origin.sql`:
`ALTER TABLE patterns ADD COLUMN origin TEXT NOT NULL DEFAULT 'curated'`.

- Existing `0002` seed rows inherit `origin = 'curated'` and fall under
  reconcile control immediately.
- Reconcile only ever reads/writes `WHERE origin = 'curated'`. A future
  user-authored pattern is inserted with `origin = 'user'` and is invisible
  to reconcile.
- **Why a column over an id-prefix convention** (`seed-*` = curated): a
  prefix is implicit and breaks the moment a curated slug doesn't start with
  `seed-`; a column is explicit and survives renames.
- `created_at` for curated rows: preserved if the row already exists, set to
  a deterministic value derived from manifest order on first insert (keeps
  the existing `created_at DESC, id` listing stable — see decision 5 of
  `add-pattern-library`).

### 3. Reconcile = generate one SQL script from the manifest, apply via `wrangler d1 execute --file`

`scripts/sync-patterns.mjs`:

1. Parse every `content/patterns/*.md` → validate (source_url required,
   ids unique) → fail the whole run on any error, changing nothing.
2. Emit a single SQL file: `BEGIN;` then, per entry,
   `INSERT INTO patterns (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET
   title=…, code=…, source_url=…, source_author=…, origin='curated'`;
   replace that pattern's `pattern_tags` rows; then
   `DELETE FROM pattern_tags WHERE pattern_id IN (SELECT id FROM patterns
   WHERE origin='curated' AND id NOT IN (<manifest ids>))` and
   `DELETE FROM patterns WHERE origin='curated' AND id NOT IN (<manifest
   ids>)`; `COMMIT;`.
3. Apply with `wrangler d1 execute PATTERNS_DB {--local|--remote} --file
   <tmp>.sql` (`CI=1`, stdin closed — same treatment as the migration step).

- Idempotent by construction: upsert + prune converge; a second run with the
  same manifest writes the same rows and deletes nothing.
- **Why generate SQL and use `wrangler d1 execute` over a Workers-runtime
  seeding route or the D1 HTTP API:** `deploy.mjs` already shells `wrangler`
  for migrations; this reuses the exact auth and connection path with no new
  credentials, and the transaction gives all-or-nothing.
- **Why not a new migration per catalog edit:** that is the status quo this
  change removes — migrations are for schema, the manifest is for data.

### 4. Wiring

- `scripts/deploy.mjs`: insert `node scripts/sync-patterns.mjs --remote`
  between the `d1 migrations apply --remote` step and `wrangler deploy`.
- `package.json`: `db:migrate:local` becomes `… migrations apply --local &&
  node scripts/sync-patterns.mjs --local`. A standalone `patterns:sync`
  script for re-running by hand.
- Tests already assert on seed data; they will assert against the manifest
  from here on.

### 5. vitest gets the manifest through its own config, not `db:migrate:local`

`npm test` runs `db:migrate:local` first, but `@cloudflare/vitest-pool-workers`
provisions its *own* empty D1 per run and seeds it only from
`readD1Migrations('migrations/patterns')` applied in
`test/apply-migrations.ts` — the `db:migrate:local` sync never reaches it.

So the manifest parse + SQL generation live in a plain-ESM module
(`scripts/lib/patterns-manifest.mjs`) importable from Node. `vitest.config.ts`
(already async, already calls `readD1Migrations`) also builds the reconcile
SQL from the manifest and passes it as a miniflare string binding
(`PATTERNS_SEED_SQL`); `test/apply-migrations.ts` runs it against
`env.PATTERNS_DB` right after `applyD1Migrations`. Same shape as the
existing migration wiring — one source of truth (the manifest) for unit
tests, e2e (via `wrangler dev` + `db:migrate:local`), dev, and prod.

- **Why not keep `0002` as the test seed:** that reintroduces exactly the
  drift this change removes — tests would assert against 20 frozen SQL rows
  while every other environment tracks the manifest.
- `0002` stays applied (its rows are already in dev/prod D1); the first
  reconcile updates/prunes them. Its header comment gets a "manifest is now
  authoritative" note. It is not edited.

### 6. Strudel docs = a nested section, real content

`content/docs/2.strudel.md` → `content/docs/2.strudel/` with numbered
pages: `1.index.md`, `2.mini-notation.md`, `3.sounds.md`, `4.effects.md`,
`5.in-jam.md` (the subset JAM supports). Drop `placeholder: true`.

- `docs.vue` nav currently renders one flat level; it gains one level of
  children (a section with a landing page + sub-pages). Small, contained
  change to the nav builder — the lock/`authRequired` handling is unchanged.
  If nesting the docs nav turns out to need more than a contained
  `docs.vue` change, fall back to flat sibling pages
  (`2.strudel.md`, `3.strudel-mini-notation.md`, …) — content and specs
  are unaffected either way.
- Ordinary Markdown links from docs pages to `/app/patterns` (and, where
  useful, to a specific pattern) — no component, no spec impact.
- Content itself is drafted by Claude, reviewed by the maintainer before
  merge (Journey 8 story 58) — a review gate on the PR, not a system
  feature.

## Risks / Trade-offs

- **Reconcile deletes curated rows removed from the manifest** → the prune
  is scoped to `origin='curated'`; user rows (`origin='user'`) are never in
  range. The generated SQL is logged before it runs. A bad manifest fails
  validation and emits no SQL.
- **`wrangler d1 execute --file` size / statement limits** for a large
  catalog → batch the file if it ever approaches limits; the first batch
  (~50–100 patterns) is well within them.
- **Tests coupled to manifest content** → tests assert on stable facts
  (a known `seed-*` id exists, tag filter narrows the set) rather than
  exact counts. `pattern-playback.spec.ts` previously clicked pattern
  rows on page 1 of the library — fine at 20, broken once the catalog
  needs a second page; it now summons each pattern through the search
  box, which is size-independent.
- **Partial failure mid-apply** → single `BEGIN;…COMMIT;` file; D1 rolls
  back on error, leaving the previous catalog intact.
- **Local and remote drift** if someone deploys without running the local
  sync → deploy always runs `--remote` sync itself; local sync is only for
  dev parity.

## Migration Plan

1. Ship `0004_pattern_origin.sql` (adds `origin`, existing rows → `curated`).
2. Author `content/patterns/*.md` for the `0002` rows worth keeping (same
   ids) + the first awesome-strudel batch.
3. First `npm run deploy` runs the sync: upserts the manifest, prunes any
   `0002` seed row not carried into the manifest.
4. Rollback: revert the change; the old `0002` rows are already in the DB
   for any id kept, and a re-deploy of the prior worker needs no catalog
   change. Dropping the `origin` column is not required for rollback (it has
   a default and nothing else reads it).

## Open Questions

- Exact size of the first awesome-strudel batch (50? 100?) — a content
  decision that does not affect the mechanism, specs, or tasks.
