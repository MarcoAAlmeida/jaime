## 1. Schema: mark curated rows

- [x] 1.1 `migrations/patterns/0004_pattern_origin.sql` —
      `ALTER TABLE patterns ADD COLUMN origin TEXT NOT NULL DEFAULT
      'curated'` + `idx_patterns_origin`. Applies cleanly `--local`;
      existing `0002` rows become `origin = 'curated'`. `0002`'s header
      comment now points at the manifest.
- [x] 1.2 `server/catalog/patterns.ts` read paths use explicit column
      lists everywhere (no `SELECT *`) — `origin` is invisible to the
      API with no code change.

## 2. Manifest format + parser

- [x] 2.1 `content/patterns/README.md` documents the shape: `<id>.md`,
      frontmatter `title` / `tags` / `source_url` / optional
      `source_author` / `description` / `created_at`; body is one
      ```` ```strudel ```` fence.
- [x] 2.2 `scripts/lib/patterns-manifest.mjs` — plain ESM, imported by
      `scripts/sync-patterns.mjs` and `vitest.config.ts`. `readManifest`
      splits frontmatter (`yaml` — now a direct devDep) / body, extracts
      the fence, returns id-sorted typed entries, throws `ManifestError`
      listing every problem (missing `source_url`, no fence, bad YAML).
- [x] 2.3 Same module: `validateManifest` (dup ids), `toReconcileSql`
      (upsert + tag rebuild + curated-scoped prune; `'` escaped; empty
      manifest safe), `buildReconcileSql` = read+validate+generate.
      Chose plain multi-statement SQL over `BEGIN;…COMMIT;` — wrangler
      `d1 execute --file` batches statements atomically and rejects a
      nested transaction.
- [x] 2.4 `scripts/lib/patterns-manifest.test.mjs` (`node --test`, 12
      cases) — parse, numeric-tag coercion, no-source, no-fence, bad
      frontmatter, multi-problem, id sort, dup id, quote escaping, prune
      scope, stability, empty manifest. `npm run test:scripts`.

## 3. Reconcile script

- [x] 3.1 `scripts/sync-patterns.mjs` — thin CLI over
      `buildReconcileSql()`; on `ManifestError` prints it and exits 1
      before touching the DB. Undated entries get a deterministic
      `created_at` (base `2026-09-01` + id-sorted index); existing rows
      keep theirs (upsert doesn't rewrite `created_at`).
- [x] 3.2 `wrangler d1 execute PATTERNS_DB {--local|--remote} --file
      <tmp>` with `CI=1`, stdin closed, `--yes` on remote. Logs the SQL
      first; non-zero exit on failure. Verified `--local`: 20 patterns /
      53 tags, second run a no-op, an `origin='user'` row survived a
      reconcile, a stray curated row was pruned.
- [x] 3.3 Idempotency confirmed (2.4 + the `--local` run above).
- [x] 3.4 `vitest.config.ts` builds `PATTERNS_SEED_SQL` via
      `buildReconcileSql()`, passed as a miniflare binding;
      `test/apply-migrations.ts` runs it line-by-line after
      `applyD1Migrations`; `test/env.d.ts` types it. 21 pattern tests
      pass against the manifest-seeded DB.

## 4. Wiring

- [x] 4.1 `scripts/deploy.mjs` — `node scripts/sync-patterns.mjs
      --remote` runs between `d1 migrations apply --remote` and
      `wrangler deploy`; the loop already aborts on any non-zero step.
- [x] 4.2 `package.json` — `db:migrate:local` / `db:migrate:remote` now
      chain the sync; `patterns:sync` standalone; `test:scripts` runs
      the node tests and is first in `test`. `dev` / `test` / `test:e2e`
      inherit the sync via `db:migrate:local`. Added `yaml` devDep.
- [x] 4.3 `db:migrate:local` on the local D1 → `/api/patterns` returns
      the 20 manifest patterns; tag filter + search covered by the
      passing `patterns-catalog` / `patterns-api` suites.

## 5. Author the first curated batch

- [x] 5.1 All 20 `0002` seed patterns are now
      `content/patterns/seed-*.md` (same ids, tags, code, `created_at`).
      `0002`'s header comment points at the manifest.
- [x] 5.2 26 new starter patterns (`content/patterns/*.md`, catalog
      20 → 46) across drums / bass / synth / melody / generative / fx /
      ambient / chords. Every construct is one a seed pattern already
      exercises; samples are dirt-samples only; every file has a real
      strudel.cc `source_url`. Decision recorded: awesome-strudel is
      song-covers, not snippets — see proposal.
- [x] 5.3 `pattern-playback.spec.ts` (all 46 evaluate, no pattern
      error) and `pattern-loading.spec.ts` (preview + Load into JAM)
      pass against the manifest-seeded catalog.

## 6. Strudel docs content

- [x] 6.1 `content/docs/2.strudel.md` → `content/docs/2.strudel/` with
      `1.index.md` + `2.mini-notation`, `3.sounds`, `4.effects`,
      `5.in-jam`. No `placeholder` flag.
- [x] 6.2 `app/layouts/docs.vue` — `toItem()` recursively maps a
      section's `children` into `UNavigationMenu` items (`defaultOpen`),
      `authRequired` lock handling unchanged.
- [x] 6.3 Real content on each page — mini-notation, sound sources /
      synths, the effects & signals chain, and exactly which Strudel
      packages JAM's engine loads + what it leaves out. Plain links to
      `/app/patterns`. (Maintainer review is the PR gate, story 58.)
- [x] 6.4 Landing page is `content/docs/2.strudel.md` beside the
      `2.strudel/` folder (a bare `1.index.md` inside the folder did not
      resolve to `/docs/strudel`); nav shows the four nested children,
      `queryCollectionNavigation` + gate verified via `e2e/docs.spec.ts`.

## 7. Tests + verification

- [x] 7.1 Fixtures de-counted: `patterns-catalog` / `patterns-api`
      assert "≥ N" and "seen == total" not "== 20"; the acid-tag shape
      test finds `seed-acid-line` by id. `pattern-playback.spec.ts`
      rewritten to summon each pattern with the search box (was: click
      rows on page 1 — broke past 24 patterns); `pattern-loading.spec.ts`
      does the same for its two fixed patterns.
- [x] 7.2 `e2e/docs.spec.ts` — Strudel section is nested, sub-pages in
      the nav and rendering, a docs→`/app/patterns` link resolves, the
      `behind-the-scenes` gate still holds for anon.
- [x] 7.3 `nuxt typecheck` (0), `npm test` (12 node + 77 vitest),
      `playwright test` (22) all green.
- [x] 7.4 `--local` reconcile verified during 3.2: `/api/patterns`
      matches the manifest, a hand-inserted `origin='user'` row survived
      a reconcile, a stray `origin='curated'` row was pruned.
- [x] 7.5 `npm run deploy` (version 2af68e6b) ran the `--remote` sync:
      remote `jaime-patterns` now has 46 patterns, all `origin='curated'`,
      the new ones served by `/api/patterns`. `/docs/strudel` + all four
      sub-pages return 200 with the nested nav.

## 8. Spec sync + archive

- [x] 8.1 `openspec validate add-content-authoring --strict` — valid.
- [x] 8.2 `pattern-library` delta synced — the 3 manifest requirements
      merged into `openspec/specs/pattern-library/spec.md` (8 → 11);
      change archived to `2026-08-31-add-content-authoring/`.
- [x] 8.3 `docs/04-roadmap/index.md` + `AGENTS.md` — Phase 5 (part one)
      marked shipped; carryover noted (docs search, Hydra / TidalCycles,
      more patterns).
