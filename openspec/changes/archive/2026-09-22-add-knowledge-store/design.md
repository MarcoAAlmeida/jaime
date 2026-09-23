## Context

See `proposal.md` for why. This is Phase 1 of `docs/04-roadmap/jah-intelligence/`;
`add-strudel-knowledge-corpus` (committed, not yet archived) already
produces `content/knowledge/strudel.json` — see its `strudel-knowledge`
spec for the exact chunk schema (id, kind, title, category, tags, text,
sourceUrl, license, version, plus synonyms/params/examples for `function`
chunks).

**The precedent this change deliberately copies**, verified in the current
code:
- `migrations/patterns/0001_init.sql` — `patterns` (flat columns) plus a
  child `pattern_tags(pattern_id, tag)` table with a composite primary key
  and an index on `tag`.
- `scripts/lib/patterns-manifest.mjs`'s `toReconcileSql(entries)` — for
  every entry, one `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`; then
  `DELETE FROM pattern_tags WHERE pattern_id IN (<ids>)` followed by a
  fresh bulk `INSERT INTO pattern_tags`, rebuilding tags from scratch
  every time rather than diffing them; then two `DELETE ... WHERE origin=
  'curated' AND id NOT IN (<ids>)` statements pruning rows the manifest no
  longer lists. `buildReconcileSql()` wraps it: read the manifest, build
  this SQL.
- `scripts/sync-patterns.mjs` — takes `--local`/`--remote`, writes the
  generated SQL to a temp file, runs `wrangler d1 execute PATTERNS_DB
  <target> --file <file>`.
- `package.json`: `db:migrate:local` runs the D1 migrations then
  `sync-patterns.mjs --local`; `db:migrate:remote` the same with
  `--remote`. `npm test` runs `db:migrate:local`.
- `scripts/deploy.mjs`: build → migrate `--remote` → `sync-patterns.mjs
  --remote` → `wrangler deploy`, as one script, each step's failure
  stopping the rest.

**On "idempotent"**: patterns' own reconcile does not diff or skip
anything — it always regenerates and executes the full SQL from the
current manifest. It is idempotent in *outcome* (running it twice with
the same manifest leaves the same rows), not in *mechanism* (it always
re-issues every `INSERT ... ON CONFLICT DO UPDATE`). This change follows
the same, simpler mechanism rather than adding change-detection patterns
doesn't have — consistent with the codebase, and cheap enough at this
corpus's size (~1,400 rows) to just always reconcile in full.

## Goals / Non-Goals

**Goals:**
- Every chunk in the committed corpus is retrievable from `PATTERNS_DB`
  by its id, and (for functions) by any synonym, after a deploy.
- The store never drifts from the committed corpus file — a deploy always
  reconciles it, the same guarantee patterns already have.
- Stay inside `PATTERNS_DB`; no new binding, no new D1 database, no
  `wrangler.jsonc` change.

**Non-Goals:**
- Any full-text or semantic/vector search. Only exact id/synonym lookup.
  Whether search is added at all, and how, is `add-jah-knowledge-retrieval`'s
  question, informed by the eval — not decided or built here.
- Any API route or UI surface reading the store. Nothing yet calls this;
  it exists so the next change has something to call.
- Re-deriving or validating chunk content — that's the corpus's own job
  (`add-strudel-knowledge-corpus`); this change only stores what the file
  already contains.

## Decisions

### 1. Schema — normalized child tables, mirroring `pattern_tags`

```sql
CREATE TABLE knowledge_chunks (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,   -- 'function' | 'concept' | 'example'
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  text       TEXT NOT NULL,
  source_url TEXT,
  license    TEXT NOT NULL,
  version    TEXT NOT NULL
);

CREATE TABLE knowledge_chunk_tags (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  tag      TEXT NOT NULL,
  PRIMARY KEY (chunk_id, tag)
);
CREATE INDEX idx_knowledge_chunk_tags_tag ON knowledge_chunk_tags(tag);

CREATE TABLE knowledge_chunk_synonyms (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  synonym  TEXT NOT NULL,
  PRIMARY KEY (chunk_id, synonym)
);
CREATE INDEX idx_knowledge_chunk_synonyms_synonym ON knowledge_chunk_synonyms(synonym);

CREATE TABLE knowledge_chunk_params (
  chunk_id    TEXT NOT NULL REFERENCES knowledge_chunks(id),
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  types       TEXT,   -- JSON array of type-name strings
  description TEXT,
  PRIMARY KEY (chunk_id, position)
);

CREATE TABLE knowledge_chunk_examples (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  position INTEGER NOT NULL,
  code     TEXT NOT NULL,
  PRIMARY KEY (chunk_id, position)
);
```
`concept`/`example` chunks simply have no rows in the synonym/param/example
child tables (they carry none, per the corpus schema). `types` is stored as
a JSON string (D1/SQLite has no array column) — read back with
`JSON.parse`; nothing in this change reads it yet, but the shape is fixed
now so the next change doesn't have to migrate it. New migration file:
`migrations/patterns/0009_knowledge_chunks.sql` (next after
`0008_pattern_favorite.sql`).

Alternative considered: one wide table with tags/synonyms as a delimited
string. Rejected — `pattern_tags`'s child-table shape already exists,
already has a proven reconcile pattern, and supports indexed lookup
(`idx_knowledge_chunk_synonyms_synonym`) directly, which a delimited
string cannot.

### 2. The reconcile SQL — a new module mirroring `patterns-manifest.mjs`

New `scripts/lib/knowledge-store.mjs`:
- `readCorpus(path = 'content/knowledge/strudel.json')` — reads and
  `JSON.parse`s the committed file (no validation beyond what
  `add-strudel-knowledge-corpus` already guarantees; this module trusts
  its own upstream).
- `toKnowledgeReconcileSql(chunks)` — for each chunk, one
  `INSERT INTO knowledge_chunks (...) VALUES (...) ON CONFLICT(id) DO
  UPDATE SET ...`; then, exactly like `pattern_tags`, a blanket
  `DELETE FROM knowledge_chunk_tags WHERE chunk_id IN (<ids>)` followed by
  a fresh bulk insert (same for synonyms, params, examples); then prune
  rows whose id isn't in the corpus at all: `DELETE FROM
  knowledge_chunk_tags WHERE chunk_id IN (SELECT id FROM knowledge_chunks
  WHERE id NOT IN (<ids>))` (and the same for the other three child
  tables) followed by `DELETE FROM knowledge_chunks WHERE id NOT IN
  (<ids>)`. Unlike patterns, every row here is corpus-owned — there's no
  `origin` column to distinguish "ours" from "someone else's" (nothing
  else ever writes to these tables), so the prune has no `WHERE origin=...`
  guard to carry over.
- `buildKnowledgeReconcileSql(path)` — `toKnowledgeReconcileSql(readCorpus(path).chunks)`,
  the same two-function split `patterns-manifest.mjs` uses (a pure
  SQL-builder over already-parsed data, plus a thin file-reading wrapper),
  so the SQL builder itself is testable with fixture chunk arrays and no
  filesystem access.

New `scripts/sync-knowledge.mjs`, structurally identical to
`sync-patterns.mjs`: build the SQL, write it to a temp file, run
`wrangler d1 execute PATTERNS_DB <--local|--remote> --file <file>`, with
`--yes` on `--remote` and `CI=1` set (same non-interactive treatment
`sync-patterns.mjs` already needs).

### 3. Wiring — deploy and local migrate, alongside patterns

`package.json`:
```
"db:migrate:local": "wrangler d1 migrations apply PATTERNS_DB --local && node scripts/sync-patterns.mjs --local && node scripts/sync-knowledge.mjs --local",
"db:migrate:remote": "wrangler d1 migrations apply PATTERNS_DB --remote && node scripts/sync-patterns.mjs --remote && node scripts/sync-knowledge.mjs --remote",
```
`scripts/deploy.mjs` gets one new step, `['node', ['scripts/sync-knowledge.mjs', '--remote']]`, placed after the existing pattern-sync step (both reconcile the same database; order between them doesn't matter, but keeping the new step visually grouped with its migration is clearer to read).

`npm test` already runs `db:migrate:local`, so this needs no separate
test-only wiring — a full local `PATTERNS_DB`, patterns and knowledge
chunks both, is what every test already runs against.

### 4. Lookup lives in `server/catalog/`, not the reconcile script — corrected during implementation

Original draft of this decision put `findChunkByName` in
`scripts/lib/knowledge-store.mjs`, alongside the reconcile SQL builder.
Wrong split, caught while implementing: patterns keep these two concerns
in different places on purpose — `scripts/lib/patterns-manifest.mjs`
builds reconcile SQL (a build/deploy-time, Node-script concern), while
all read access goes through `server/catalog/patterns.ts` (a runtime,
Cloudflare-Worker concern, typed against `D1Database`, tested via
`cloudflare:test`'s real local D1 the same way `test/patterns-catalog.test.ts`
does). Mixing a runtime read function into the Node-only reconcile module would
make it the one piece of `server` code importing from `scripts/`, which
nothing else in the codebase does.

So: **`server/catalog/knowledge.ts`** (new file), mirroring
`server/catalog/patterns.ts`'s own shape — `getPattern`'s two-query
pattern (row, then a child-table query) repeated once per child table
here:
```ts
export interface KnowledgeChunk {
  id: string
  kind: 'function' | 'concept' | 'example'
  title: string
  category: string
  tags: string[]
  text: string
  sourceUrl: string | null
  license: string
  version: string
  synonyms: string[]
  params: Array<{ name: string, types: string[], description: string | null }>
  examples: string[]
}

export async function findChunkByName(db: D1Database, name: string): Promise<KnowledgeChunk | null>
```
`findChunkByName` resolves `name` against `knowledge_chunks.id` directly
or via `knowledge_chunk_synonyms.synonym` in one query
(`WHERE id = ?1 OR id IN (SELECT chunk_id FROM knowledge_chunk_synonyms
WHERE synonym = ?1)`), then assembles tags/synonyms/params/examples from
their child tables keyed by the resolved id, returning `null` when
nothing matches.

**A real ambiguity, found by the real corpus, not invented**: `lpf`
declares `cutoff` as a synonym, but the corpus also documents a distinct,
real function literally named `cutoff` (`packages/supradough/dough.mjs`
— the same low-level module whose duplicate names against
`controls.mjs` were already noted in `add-strudel-knowledge-corpus`'s own
"Verified against the real submodule" section). A single query matching
either condition naturally resolves this by favoring the direct id match
— a chunk's own true identity wins over being referenced as someone
else's alias, which the spec's wording doesn't forbid (it only requires
that a synonym resolve *to* the chunk that declared it, not that it
outrank a distinct chunk's own id) and is the more honest answer to give.
Pinned by a test (`knowledge-catalog.test.ts`) rather than left as an
accident of query order.

The type stays local to this file rather than
`shared/catalog.ts` — nothing crosses the server/client boundary yet
(no route uses this); promoting it to `shared/` is
`add-jah-knowledge-retrieval`'s concern, whenever it adds one.

This function is exercised by this change's own test
(`test/knowledge-catalog.test.ts`, against the local D1 the vitest pool
provisions, seeded the same way `patterns-catalog.test.ts` is) but has no
caller yet — `server/jah/*` is untouched here, per the proposal's scope.

## Risks / Trade-offs

- **[Full reconcile on every deploy, at ~1,400 rows]** → Cheap: patterns
  already does the equivalent shape at smaller scale, and D1 handles a
  few thousand upserts in a single `wrangler d1 execute` well within a
  deploy's existing time budget. Revisit only if this is ever measured to
  matter.
- **[No `origin`-style guard on the prune, unlike patterns]** → By design:
  nothing else writes to `knowledge_chunks`, so "not in the corpus" and
  "should be deleted" are the same condition. If something else ever
  needs to own rows here independently (unlikely, no such need exists),
  this would need the same `origin` treatment patterns has.
- **[`types` as a JSON string column]** → D1/SQLite has no array type;
  documented in decision 1. Read-side JSON parsing is
  `add-jah-knowledge-retrieval`'s concern, not built here.

## Migration Plan

Additive: one new migration, one new script, two small `package.json`
wiring changes, one new step in `deploy.mjs`. No existing table changes,
no existing route changes. Rollback is a new migration dropping the four
tables (D1 migrations are forward-only, matching how `0004`/`0008` were
themselves additive rather than edits to `0001`).
