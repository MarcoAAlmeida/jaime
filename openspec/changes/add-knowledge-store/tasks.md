## 1. Migration

- [x] 1.1 `migrations/patterns/0009_knowledge_chunks.sql`: `knowledge_chunks`,
      `knowledge_chunk_tags` (+ index on `tag`), `knowledge_chunk_synonyms`
      (+ index on `synonym`), `knowledge_chunk_params`,
      `knowledge_chunk_examples` — exact columns per design.md decision 1.

## 2. The reconcile SQL builder (pure, offline)

- [x] 2.1 `scripts/lib/knowledge-store.mjs`: `toKnowledgeReconcileSql(chunks)`
      — per chunk, an `INSERT ... ON CONFLICT(id) DO UPDATE`; blanket
      delete + bulk re-insert of tags/synonyms/params/examples for every
      chunk id present; then prune every child table and `knowledge_chunks`
      itself for any id not in `chunks`. Mirrors
      `scripts/lib/patterns-manifest.mjs`'s `toReconcileSql` shape. Tests:
      a chunk with tags/synonyms/params/examples produces the right rows
      for each; a concept chunk (no synonyms/params/examples) produces
      none of those child rows; re-running with the same input is a no-op
      in outcome (same statements every time, not literally skipped —
      design.md's note on "idempotent"); a chunk removed from the input
      is pruned from every table; a chunk edited (same id, different
      text) updates rather than duplicating.
- [x] 2.2 `readCorpus(path)` / `buildKnowledgeReconcileSql(path)`: read +
      parse `content/knowledge/strudel.json`, call 2.1. Test against the
      real committed file (a smoke test: it parses, produces non-empty
      SQL, no chunk id is missing).
- [x] 2.3 `findChunkByName(db, name)`: one query resolving a chunk by id
      or by any synonym, assembling its tags/synonyms/params/examples from
      the child tables; returns `null` when nothing matches. Test against
      a real local D1 (the vitest pool provisions one per test file) with
      a handful of seeded chunks: found by id, found by synonym, two
      different chunks' synonyms don't cross-match, missing name → `null`.

## 3. The sync script and wiring

- [x] 3.1 `scripts/sync-knowledge.mjs`: `--local`/`--remote`, writes the
      built SQL to a temp file, runs `wrangler d1 execute PATTERNS_DB
      <target> --file <file>` (`--yes` + `CI=1` on `--remote`) — structurally
      identical to `scripts/sync-patterns.mjs`.
- [x] 3.2 `package.json`: `db:migrate:local`/`db:migrate:remote` each gain
      `&& node scripts/sync-knowledge.mjs --local|--remote` after the
      existing pattern sync step.
- [x] 3.3 `scripts/deploy.mjs`: add the `sync-knowledge.mjs --remote` step
      after the existing pattern-sync step.

## 4. Verification

- [x] 4.1 `npm run db:migrate:local` (real run): migration applies, the
      real committed corpus reconciles into the local D1 without error;
      spot-check a few rows via `wrangler d1 execute PATTERNS_DB --local
      --command "..."` (e.g. `rev`'s row, its tags, its one example).
- [x] 4.2 Re-run `npm run db:migrate:local` a second time with nothing
      changed: confirm the same spot-checked rows read identically (the
      idempotent-in-outcome guarantee, checked for real, not only in the
      pure-function tests).
- [x] 4.3 `npm test` and `npm run typecheck` are green — offline, no
      submodule, no real model, no network beyond the local D1 the test
      pool already provisions.
- [x] 4.4 `openspec validate add-knowledge-store --strict`.
- [ ] 4.5 After the developer's review: sync the `strudel-knowledge`
      delta into `openspec/specs/`; archive.
