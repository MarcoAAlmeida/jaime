## 1. Real infrastructure (developer action — ask before doing)

- [x] 1.1 **Ask the developer to run, or explicitly approve running**,
      `npx wrangler vectorize create jaime-knowledge --dimensions=768
      --metric=cosine` — a real, billable, permanent (dimensions/metric
      can never change) account resource. Do not create it unattended.
- [x] 1.2 `wrangler.jsonc`: add the `vectorize` binding
      (`{ binding: "VECTORIZE", index_name: "jaime-knowledge" }`) once
      1.1 is done.
- [x] 1.3 New minimal wrangler config for Node-side access (mirrors
      `scripts/jah-prompt-eval.wrangler.jsonc`): `ai` + `vectorize`
      bindings only, nothing else.

## 2. Migration

- [x] 2.1 `migrations/patterns/0010_knowledge_chunk_embeddings.sql`:
      `knowledge_chunk_embeddings(chunk_id TEXT PRIMARY KEY, text_hash
      TEXT NOT NULL, embedded_at TEXT NOT NULL)`.

## 3. Embedding logic (pure functions, offline-testable)

- [x] 3.1 `scripts/lib/knowledge-search.mjs`: `textToEmbed(chunk)` —
      `title + ": " + text`, truncated to the design's character budget,
      returning both the string and whether it was truncated. Tests:
      short text unchanged; long text truncated with the flag set;
      empty text still produces a sensible string from the title alone.
- [x] 3.2 `hashEmbeddedText(text)` — a stable hash for change detection.
      Test: same text same hash, different text different hash.
- [x] 3.3 `planEmbeddingWork(chunks, existingHashes)` — pure function:
      given the corpus chunks and a `Map<chunkId, textHash>` of what's
      already embedded, returns `{ toEmbed: [...chunks needing (re-)
      embedding], toDelete: [...chunk ids to remove] }`. Tests: a new
      chunk needs embedding; an unchanged chunk (same hash) doesn't; a
      changed chunk (different hash) does; a chunk id no longer present
      in `chunks` is planned for deletion.

## 4. Wiring the reconcile step

- [x] 4.1 `scripts/lib/knowledge-search.mjs`: `embedAndUpsert(ai,
      vectorize, db, chunks)` — reads `knowledge_chunk_embeddings`, calls
      `planEmbeddingWork`, batch-embeds via `ai.run('@cf/baai/bge-base-en-v1.5',
      { text: [...] })`, `vectorize.upsert(...)`, updates
      `knowledge_chunk_embeddings`, then `vectorize.deleteByIds(...)` and
      deletes the corresponding tracking rows for anything planned for
      deletion. Reports counts (embedded, skipped, deleted, truncated) —
      printed by the caller, not swallowed.
- [x] 4.2 `scripts/sync-knowledge.mjs`: after the existing D1 SQL
      reconcile, open `env.AI`/`env.VECTORIZE` via `getPlatformProxy`
      with the new minimal config (task 1.3), call `embedAndUpsert`,
      print its summary. `--local` runs still execute the D1 phase
      normally; skip the embedding phase for `--local` entirely (spec's
      "never in automated tests" extends naturally to "never for a
      developer's local D1 sync either" — there is no local index to
      embed into, and `db:migrate:local`/`npm test` must not require
      Workers AI network access at all).

## 5. `searchChunks`

- [x] 5.1 `server/catalog/knowledge.ts`: `searchChunks(ai, vectorize, db,
      query, topK = 5)` — embed `query`, `vectorize.query(...)`, resolve
      each result id through `findChunkByName`. Tests with injected fake
      `Ai`/`Vectorize` objects (shape-matching the real bindings): returns
      chunks in the fake's ranked order; an empty result list returns
      `[]`, not an error; `topK` is honored.

## 6. Verification

- [ ] 6.1 After task 1 is genuinely done (real index exists, binding
      wired): run `npm run db:migrate:remote` for real (or the deploy
      pipeline) and confirm the console summary reports embedding counts
      that make sense (roughly the corpus's chunk count on the first
      run, near-zero on a second immediate run).
- [ ] 6.2 Spot-check via `npx wrangler vectorize query jaime-knowledge
      --vector <embedded-query-vector-or-use-a-quick-script>` (or a
      one-off script calling `searchChunks` directly against the real
      binding) with a genuinely vague query (not a function name) and
      confirm the results are topically sensible.
- [x] 6.3 Confirm `--local`/`npm test` never attempt real Workers AI or
      Vectorize network access (no `wrangler login` should be required to
      run the test suite).
- [x] 6.4 `npm test` and `npm run typecheck` are green.
- [x] 6.5 `openspec validate add-knowledge-search --strict`.
- [x] 6.6 After the developer's review: sync the `strudel-knowledge`
      delta into `openspec/specs/`; archive.
