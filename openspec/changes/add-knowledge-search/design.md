## Context

See `proposal.md` for why; see `add-knowledge-store`'s design.md for the
D1 schema and reconcile precedent this extends (`knowledge_chunks` +
child tables, `scripts/lib/knowledge-store.mjs`, `scripts/sync-knowledge.mjs`,
wired into `db:migrate:local`/`db:migrate:remote`/`deploy.mjs`).

**Verified facts that shape this design:**
- Cloudflare's own docs list Vectorize as **not supported for local
  development** at all (D1: local ✅; Vectorize: local ❌, remote only).
  There is no Miniflare simulation for it, unlike D1's `--local` mode.
- The embedding model, `@cf/baai/bge-base-en-v1.5`: 768-dimensional
  output, cosine or euclidean or dot-product metric (chosen once, fixed
  forever), **512 maximum input tokens per text**, $0.0666 per million
  input tokens, supports batched input.
- A Vectorize index's `dimensions` and `metric` are fixed permanently at
  creation (`npx wrangler vectorize create <name> --dimensions=768
  --metric=cosine`) — a real, one-time, account-level provisioning step,
  not something `wrangler deploy` creates on its own.
- `scripts/jah-prompt-eval.mjs` and `scripts/jah-eval/lib/model.mjs`
  already call Workers AI from a plain Node script via `wrangler`'s
  `getPlatformProxy({ configPath })`, pointed at a **minimal** wrangler
  config (`ai: { binding: "AI" }` only) so the app's own Durable
  Object/D1/assets bindings aren't dragged in and `.output/public` isn't
  locked while a build might be running.
- This project has a single branch and no staging environment
  (`AGENTS.md`: "Single branch, main"; every push tests then deploys
  straight to production) — there is no existing "dev" tier for a second
  index to naturally belong to.

## Goals / Non-Goals

**Goals:**
- A chunk is findable by meaning, kept in exact sync with the corpus,
  the same guarantee `add-knowledge-store` already gives exact lookup.
- Keep embedding cost bounded as the corpus grows: only changed chunks
  are re-embedded.
- Automated tests never touch a real embedding call or a real index —
  not optional, given Vectorize's local-dev limitation means "accidentally
  local" isn't even possible; it's real or nothing.

**Non-Goals:**
- Wiring this into `@jah`'s replies or the chat UI — `add-jah-knowledge-retrieval`.
- Re-ranking, hybrid search, or query rewriting. `searchChunks` returns
  Vectorize's own ranking, unmodified.
- A dev/prod index split at this stage (decision 2).

## Decisions

### 1. One index, `@cf/baai/bge-base-en-v1.5`, cosine

`npx wrangler vectorize create jaime-knowledge --dimensions=768 --metric=cosine`,
bound in `wrangler.jsonc` as `env.VECTORIZE`. Cosine because it's the
standard choice for sentence-embedding similarity (magnitude-invariant),
and what the model's own usage examples and the general Workers AI RAG
tutorial both use. This is a real, one-time, account-level action the
developer runs (or explicitly approves) once — not something a script
creates unattended (see tasks.md).

### 2. No dev/prod split — a deliberate departure from the roadmap's original sketch

`docs/04-roadmap/jah-intelligence/README.md`'s Open Decision 2 said "use
separate dev and prod indexes; never let local dev or CI touch prod" —
written before confirming that Vectorize has no local-dev mode at all.
With that confirmed:
- **CI and `npm test` can never touch any real index anyway** — spec
  requirement "Search Never Runs Against A Real Index In Automated
  Tests" is met by stubbing, full stop, regardless of how many indexes
  exist.
- A second index would only matter for a *human* running `nuxt dev` or
  `wrangler dev` locally, and this project has no staging Worker or
  staging D1 for that index to pair with either — `PATTERNS_DB` itself
  is one production database, protected only by `--local` vs `--remote`
  (an option Vectorize doesn't have).
- The index is kept correct not by isolation but by the same discipline
  D1 already relies on: **reconciling on deploy always brings it into
  exact agreement with the committed corpus** (spec: "The Search Index
  Stays In Exact Agreement With The Corpus"), so there's no "leftover
  test garbage" risk to isolate against — a stray local upsert would be
  overwritten by the next real deploy's reconcile, the same way a stray
  local D1 row would be pruned by patterns' own reconcile.

One index, `jaime-knowledge`, for now. Revisit if a real second
environment (staging Worker, staging D1) is ever introduced for other
reasons — this isn't a decision to defend forever, just the honest
answer for what exists today.

### 3. Embedding runs inside the deploy-time reconcile, via `getPlatformProxy`

`scripts/sync-knowledge.mjs` already runs on deploy and already reconciles
`content/knowledge/strudel.json` into D1. It gains a second phase, in a
new `scripts/lib/knowledge-search.mjs`:

1. Open `env.AI` and `env.VECTORIZE` via `getPlatformProxy({ configPath:
   '<new minimal config>' })` — a sibling to
   `scripts/jah-prompt-eval.wrangler.jsonc`, containing only `ai` and
   `vectorize` bindings (not the app's D1/Durable Object/assets, for the
   same reason that file avoids them).
2. For each chunk, compute a content hash of the text actually embedded
   (decision 4) and compare it against what's recorded for that chunk id
   in a small tracking table, `knowledge_chunk_embeddings(chunk_id TEXT
   PRIMARY KEY, text_hash TEXT NOT NULL, embedded_at TEXT NOT NULL)` in
   `PATTERNS_DB` (a new migration, `0010_...`) — this is what makes
   "don't re-embed unchanged chunks" possible without calling Vectorize's
   own read API per chunk on every deploy. **Read and written via
   `wrangler d1 execute` subprocess calls, the same as every other D1
   access from a Node script in this repo (`knowledge-store.mjs`,
   `patterns-manifest.mjs`) — corrected during implementation from an
   earlier draft of this decision that had `embedAndUpsert` take a
   `D1Database` JS binding directly.** That binding would have had to
   come from a *second*, separate `getPlatformProxy` local/remote
   resolution alongside the AI/Vectorize one — a new way for this script
   to reach D1, with a real risk of accidentally resolving local when
   remote was intended (or vice versa) that the existing subprocess
   mechanism, already proven correct for `--local`/`--remote` in this
   exact script, does not have. `embedAndUpsert(ai, vectorize,
   existingHashes, chunks)` therefore takes and returns plain data (a
   `Map` in, `{ updatedHashes, deletedIds }` out); `sync-knowledge.mjs`
   reads the current hashes with `wrangler d1 execute ... --command
   "SELECT chunk_id, text_hash FROM knowledge_chunk_embeddings" --json`
   and persists the result with a small SQL builder,
   `toEmbeddingTrackingSql`, run through the same `--file` mechanism as
   the chunk reconcile.
3. Batch-embed everything new or changed (`bge-base-en-v1.5` accepts an
   array of strings, batched at 100 per call — Vectorize's own upsert
   limit is 1,000 vectors per call on the Workers binding, confirmed in
   its platform limits) and `env.VECTORIZE.upsert([{ id, values }, ...])`.
4. Delete from Vectorize (`env.VECTORIZE.deleteByIds`) for any id no
   longer in the corpus, and prune `knowledge_chunk_embeddings` to match
   via the same SQL builder — the prune half of the "exact agreement"
   guarantee.
5. `sync-knowledge.mjs` still also runs the existing D1 chunk reconcile
   (`add-knowledge-store`'s `toKnowledgeReconcileSql`) first — a
   completely separate `wrangler d1 execute` call, since it doesn't need
   the AI/Vectorize bindings at all. Embedding is likely slower (real API
   calls), so it runs second, after the cheaper, more important part.
6. **The embedding phase is skipped entirely for `--local`** (and so for
   `npm run db:migrate:local` and `npm test`): there is no local Vectorize
   to embed into, and a developer's local sync or the test suite must
   never need Workers AI network access or `wrangler login` at all. Only
   `--remote` (deploy) runs it.

### 4. What gets embedded, and the 512-token limit

Embed `title + ": " + text` (a function's name/title prefixed onto its
description gives the embedding an anchor even when the description alone
is thin or empty — real examples exist, e.g. the anonymous-doclet gap
already filtered in `add-strudel-knowledge-corpus`, and some doclets have
very short descriptions). Truncate to a safe character budget before
sending (roughly 512 tokens ≈ 2,000 characters for English text — a
rough, conservative heuristic, not a token-exact count) — a concept
chunk's prose is the one kind long enough to plausibly exceed it; function
and example chunks won't in practice. Truncation is reported (not
silent) in the reconcile's own console output, the same spirit as
`add-strudel-knowledge-corpus`'s validation reporting.

The **content hash** (decision 3.2) is computed over this same embedded
string (title + truncated text), not the raw chunk — so a change to a
field that isn't embedded (e.g. a function's `params`) doesn't trigger a
pointless re-embed.

### 5. `searchChunks` — embed the query, resolve ids back to full content

```ts
export async function searchChunks(
  ai: Ai, vectorize: Vectorize, db: D1Database, query: string, topK = 5,
): Promise<KnowledgeChunk[]>
```
in `server/catalog/knowledge.ts`, alongside `findChunkByName`: embeds
`query` with the same model, calls `env.VECTORIZE.query(vector, { topK
})`, then `findChunkByName` (by id, guaranteed to be an exact id match
here) for each result to assemble full content — reusing that function
rather than duplicating the row-assembly logic. A match below Vectorize's
own similarity floor isn't specially filtered here (spec: "returns
nothing or only genuinely low-relevance matches, distinguishable as
such" — the caller sees each result's score and can threshold as it
sees fit; this seam doesn't decide that policy, since it has no caller
yet to inform the right threshold).

### 6. Tests: a stub, always — never a real index, local or remote

New `scripts/knowledge/lib/embed.mjs`-level tests (offline, fixture text
in/embeddings-shaped-array out via an injected fake) cover the change-
detection and truncation logic in isolation, the same fixture-driven
style `add-strudel-knowledge-corpus`'s pipeline already uses. For
`searchChunks`, `test/knowledge-catalog.test.ts` gains cases with an
injected fake `Ai`/`Vectorize` (matching the shape their real bindings
expose) — there is no real-binding integration test for this function at
all, unlike `findChunkByName`'s (which could use the vitest pool's real
local D1); Vectorize offers no local equivalent to test against for real.

## Risks / Trade-offs

- **[Real, ongoing cost]** → Small (`bge-base-en-v1.5` pricing) and
  change-detected, but genuinely new — unlike `add-knowledge-store`,
  which added no cost. Worth watching as the corpus grows "considerably",
  per the developer's stated intent; revisit batching/model choice if it
  ever matters.
- **[One shared index, no isolation from a bad local upsert]** → Mitigated
  by decision 2's reasoning: the next real deploy's reconcile always
  restores exact agreement with the corpus. A manual, ad-hoc local
  experiment against the real index between deploys is the one scenario
  this doesn't protect against — acceptable for a single-developer
  project today.
- **[512-token truncation drops content for very long concept chunks]** →
  Reported, not silent (decision 4); accepted for this change. A future
  refinement could embed a chunk in multiple pieces if this proves to
  matter in practice.
- **[No integration test against a real Vectorize index, even locally]**
  → Unavoidable given decision 6's finding; the real, working pipeline is
  what task 4 (a real run against the real index) verifies instead of an
  automated test.

## Migration Plan

Additive: a new D1 migration (tracking table only — no change to
`knowledge_chunks` or its child tables), a new Vectorize index (manual,
one-time), one new binding in `wrangler.jsonc`, new library code, an
extension to the existing reconcile script. No existing behavior changes.
Rollback: stop calling the embedding phase (revert `sync-knowledge.mjs`);
the Vectorize index and its binding can be left in place harmlessly or
deleted (`npx wrangler vectorize delete jaime-knowledge`) if fully
reverting.
