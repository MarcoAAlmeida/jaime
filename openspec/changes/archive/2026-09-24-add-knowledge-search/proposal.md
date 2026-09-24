## Why

`add-knowledge-store` gives `@jah` exact lookup — a mention naming `lpf`
or `cutoff` resolves to its chunk. That covers named-function questions,
but not vague ones ("something that makes a pattern sound dubby"), and it
doesn't scale as the corpus grows: the developer intends to grow the
knowledge base considerably, and a much larger corpus makes keyword
overlap noisier just as it makes semantic matching more valuable. Per the
developer's explicit decision, semantic search is built now rather than
deferred to the eval (Phase 1's README originally left this open;
superseded here).

This is still Phase 1 of `docs/04-roadmap/jah-intelligence/`. It builds
the search *mechanism* only — `add-jah-knowledge-retrieval` wires it (and
the existing exact lookup) into `@jah`'s actual replies.

## What Changes

- **A Vectorize index** (`env.VECTORIZE`) holding one vector per chunk,
  embedded with Workers AI's `@cf/baai/bge-base-en-v1.5` (768 dimensions,
  cosine metric — both fixed permanently at index creation). Only the
  vector and its chunk id live in the index; the chunk's real content
  stays in D1 (`add-knowledge-store`), fetched by id after a search.
- **One index, not a dev/prod pair** — a deliberate departure from what
  the roadmap's README sketched; see design.md decision 2 for why
  (Vectorize has no local simulation at all, unlike D1, and this project
  has no existing environment split to hang a second index off of).
- **Embedding runs as part of the existing deploy-time reconcile**
  (`scripts/sync-knowledge.mjs`), not as part of `knowledge:refresh`:
  only chunks whose text has changed since the last embed are
  re-embedded, and the index is pruned to match the corpus exactly, the
  same guarantee `add-knowledge-store` already gives D1.
- **`searchChunks(env, query, topK)`**: embeds the query text and returns
  the closest chunks by full content (id, then a D1 fetch) — a seam with
  no caller yet, exactly like `findChunkByName`.

No change to `@jah`, to any prompt, or to what a user sees.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `strudel-knowledge`: adds semantic search over the store — a chunk is
  findable by meaning, not only by exact id or synonym, and the search
  index is kept in exact agreement with the corpus the same way the D1
  store already is.

## Impact

- **New code:** `scripts/lib/knowledge-search.mjs` (embedding + Vectorize
  upsert/prune logic, called from `sync-knowledge.mjs`), a new minimal
  wrangler config for the reconcile step's Workers AI + Vectorize access
  from Node (mirroring `scripts/jah-prompt-eval.wrangler.jsonc`),
  `searchChunks` in `server/catalog/knowledge.ts`.
- **New binding:** `vectorize` in `wrangler.jsonc` (one index).
- **Touched:** `scripts/sync-knowledge.mjs` (now also embeds/upserts),
  `test/apply-migrations.ts`/`vitest.config.ts` if a test-side stub needs
  wiring (Vectorize cannot be simulated locally at all — every automated
  test stubs it, never touching a real index).
- **Not touched:** `server/jah/*`, any prompt, any protocol, the chat UI.
- **Cost:** embedding is cheap (`bge-base-en-v1.5`: $0.0666 per million
  input tokens) and change-detected (unchanged chunks aren't re-embedded
  on every deploy) — a real, if small, new ongoing cost, unlike the D1
  store which added none.
- **Depends on:** `add-knowledge-store` (D1 schema, `findChunkByName`, the
  reconcile script this extends). **Unblocks:** `add-jah-knowledge-retrieval`.
