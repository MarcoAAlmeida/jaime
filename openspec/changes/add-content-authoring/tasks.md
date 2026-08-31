## 1. Schema: mark curated rows

- [ ] 1.1 `migrations/patterns/0004_pattern_origin.sql` —
      `ALTER TABLE patterns ADD COLUMN origin TEXT NOT NULL DEFAULT
      'curated'`. `db:migrate:local` applies it; existing `0002` rows
      become `origin = 'curated'`.
- [ ] 1.2 Confirm `server/catalog/patterns.ts` read paths are unaffected
      (no `SELECT *` that would now surface `origin`; add it to the
      row-shape mapping only if a query needs it — it should not).

## 2. Manifest format + parser

- [ ] 2.1 Decide and document the on-disk shape in a short
      `content/patterns/README.md`: `<id>.md`, frontmatter `title`,
      `tags` (list), `source_url`, optional `source_author`, optional
      `description`; body is one ```` ```strudel ```` fence with the code.
- [ ] 2.2 `scripts/lib/patterns-manifest.mjs` — plain ESM, importable
      from both the sync script and `vitest.config.ts`. `readManifest(dir)`
      reads `content/patterns/*.md`, splits frontmatter/body
      (dependency-free or `gray-matter` if already resolvable), extracts
      the code fence, returns typed entries. Throws with a per-file
      message on: missing `source_url`, missing/empty code fence,
      malformed frontmatter.
- [ ] 2.3 Same module: `validateManifest(entries)` — ids unique
      (filename stem), tags are strings; and `toReconcileSql(entries)`
      → the `BEGIN;…COMMIT;` string (decision 3). Any validation
      failure throws before any SQL is produced.
- [ ] 2.4 Unit tests for parse + validate + SQL generation (valid file,
      missing source, duplicate id, no code fence, idempotent SQL shape).

## 3. Reconcile script

- [ ] 3.1 `scripts/sync-patterns.mjs` — thin CLI over
      `scripts/lib/patterns-manifest.mjs`: read + validate the manifest,
      call `toReconcileSql`, write it to a temp file. SQL shape: `BEGIN;`,
      per entry `INSERT ... ON CONFLICT(id) DO UPDATE SET ... ,
      origin='curated'`, delete+reinsert that pattern's `pattern_tags`,
      then prune `pattern_tags` and `patterns` where `origin='curated'
      AND id NOT IN (<manifest ids>)`, `COMMIT;`. First-insert
      `created_at` from manifest order; existing rows keep theirs.
- [ ] 3.2 Apply step: `wrangler d1 execute PATTERNS_DB {--local|--remote}
      --file <tmp>` with `CI=1` and stdin closed (match `deploy.mjs`).
      `--local` / `--remote` from argv; log the generated SQL before
      applying; non-zero exit on failure.
- [ ] 3.3 Idempotency covered by 2.4 (SQL shape) + 7.4 (manual: run
      twice, second run reports nothing).
- [ ] 3.4 `vitest.config.ts` — build the reconcile SQL from the manifest
      (reuse `scripts/lib/patterns-manifest.mjs`) and pass it as a
      miniflare string binding `PATTERNS_SEED_SQL`; `test/apply-migrations.ts`
      runs it against `env.PATTERNS_DB` right after `applyD1Migrations`.
      `test/env.d.ts` types the new binding.

## 4. Wiring

- [ ] 4.1 `scripts/deploy.mjs` — add `node scripts/sync-patterns.mjs
      --remote` as a step between `d1 migrations apply --remote` and
      `wrangler deploy`; a failure aborts the deploy.
- [ ] 4.2 `package.json` — `db:migrate:local` runs the migrations then
      `node scripts/sync-patterns.mjs --local`; add a standalone
      `patterns:sync` script. `dev` / `test` / `test:e2e` inherit it
      through `db:migrate:local`.
- [ ] 4.3 Run `npm run db:migrate:local` on a clean local D1; confirm
      `/api/patterns` returns the manifest set and tag filter/search
      still work.

## 5. Author the first curated batch

- [ ] 5.1 Move every `0002` seed pattern worth keeping into
      `content/patterns/<seed-id>.md` (same ids), tags included. Note
      in `0002`'s header comment that the manifest is now authoritative.
- [ ] 5.2 Import a first batch from awesome-strudel — each file with a
      real `source_url` (and `source_author` where known) from the
      moment it is authored (spec: "an entry with no source is
      refused"). Batch size is the design's open question — start with
      a coherent ~50 and note the count in the change.
- [ ] 5.3 `npm run db:migrate:local` + spot-check the library UI:
      preview plays, attribution shows, "Load into JAM" still works.

## 6. Strudel docs content

- [ ] 6.1 Restructure `content/docs/2.strudel.md` → `content/docs/
      2.strudel/` with `1.index.md` + topic pages (`2.mini-notation`,
      `3.sounds`, `4.effects`, `5.in-jam`). Drop `placeholder: true`.
- [ ] 6.2 `app/layouts/docs.vue` — render one level of section children
      in the nav (section landing page + its sub-pages); keep the
      `authRequired` lock handling unchanged.
- [ ] 6.3 Draft real content for each page (Claude draft, maintainer
      review before merge): mini-notation, sound sources, core effects,
      and precisely which subset JAM supports today. Cross-link to
      `/app/patterns` where a concept has a matching library pattern.
- [ ] 6.4 `queryCollectionNavigation` / TOC still work with the nested
      structure; `9.behind-the-scenes` gate still works.

## 7. Tests + verification

- [ ] 7.1 Update any vitest/e2e fixtures that assumed the old seed set
      (prefer asserting "a known id exists" / "tag filter narrows" over
      exact counts).
- [ ] 7.2 e2e: the docs nav lists the Strudel sub-pages and they render;
      a docs→pattern link resolves.
- [ ] 7.3 `nuxt typecheck`, `vitest run`, `playwright test` green.
- [ ] 7.4 Manual: fresh `wrangler dev` — `/api/patterns` matches the
      manifest; add a throwaway `content/patterns/*.md`, re-run
      `patterns:sync --local`, see it appear; delete it, re-run, see it
      pruned while a non-`curated` row (insert one by hand with
      `origin='user'`) survives.
- [ ] 7.5 `npm run deploy`; confirm the remote catalog on
      `https://jaime.stream/app/patterns` matches the manifest and the
      new Strudel docs render.

## 8. Spec sync + archive

- [ ] 8.1 `openspec validate add-content-authoring --strict`.
- [ ] 8.2 Sync the `pattern-library` delta into
      `openspec/specs/pattern-library/spec.md`; archive the change.
- [ ] 8.3 `docs/04-roadmap/index.md` + `AGENTS.md` — mark Phase 5
      shipped; note remaining Phase 5 carryover (docs search, Hydra /
      TidalCycles).
