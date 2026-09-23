## Why

`add-strudel-knowledge-corpus` produces `content/knowledge/strudel.json` —
a committed, versioned set of knowledge chunks — but nothing at request
time can read it. `@jah`'s reply code runs in a Cloudflare Worker with no
filesystem access to the repo; the chunks have to live somewhere a query
can reach them before any later change can use them. This is Phase 1 of
`docs/04-roadmap/jah-intelligence/` and, per the developer's decision,
follows the same reconcile pattern the curated pattern library already
uses successfully (`scripts/sync-patterns.mjs`): a committed file is the
source of truth, and deploying makes the database match it exactly.

## What Changes

- **A new migration** (`migrations/patterns/0009_...`) adds tables for the
  knowledge chunk schema to `PATTERNS_DB` — the same D1 database patterns
  already live in. No new binding, no `wrangler.jsonc` change.
- **A reconcile script**, `scripts/sync-knowledge.mjs`, modelled directly
  on `scripts/sync-patterns.mjs`: reads `content/knowledge/strudel.json`
  and generates SQL that upserts every chunk by id and prunes any chunk id
  no longer present, then executes it against D1 (`--local` or `--remote`).
- **The reconcile runs on deploy**, exactly like patterns: `scripts/deploy.mjs`
  gets a new step (after the migrations, alongside the existing pattern
  sync), and `npm run db:migrate:local` gets the local equivalent, so
  `npm test` always runs against a fully-seeded local knowledge store. The
  committed file is the only source of truth; a deploy that doesn't touch
  the corpus reconciles it to the same state it already has.
- **Lookup by id and by synonym**, so a mention of a function or its
  alternate name resolves to its chunk — the "exact lookup" mode Phase 1's
  README describes. No search beyond that: no full-text search, no
  semantic/vector index. That is later work, decided by the eval, not
  built here.

No change to `@jah`, to any prompt, or to what a user sees.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `strudel-knowledge`: adds a requirement that the chunk file's contents
  are held in a durable store, rebuildable from the file at any time —
  the corpus's own spec today covers only producing the file, not storing
  it anywhere queryable.

## Impact

- **New code:** `scripts/sync-knowledge.mjs` (the reconcile script) and a
  small shared module it and any future read path use for chunk row
  shaping; tests covering idempotency, updates, and pruning, fully
  offline (they read only the already-committed corpus file).
- **New migration:** `migrations/patterns/0009_...` in `PATTERNS_DB`.
- **Touched:** `scripts/deploy.mjs` (one new step), `package.json`
  (`db:migrate:local` gains the local reconcile, matching how it already
  runs `sync-patterns.mjs --local`).
- **Not touched:** `server/jah/*`, any prompt, any protocol, the chat UI,
  any vector/semantic index, `wrangler.jsonc`.
- **Depends on:** `add-strudel-knowledge-corpus` (provides the corpus
  file and the `strudel-knowledge` capability this modifies). **Unblocks:**
  `add-jah-knowledge-retrieval`.
