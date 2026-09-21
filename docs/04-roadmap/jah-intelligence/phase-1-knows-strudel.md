# Phase 1 — `@jah` knows Strudel

Read [README.md](./README.md) first.

**Goal:** `@jah` answers questions about Strudel from the real documentation,
cites its sources, and stops inventing functions.

**Gate:** on the Phase 0 eval, `docs` cases beat the baseline and the
rate of non-existent functions used drops clearly. Sources appear in the
chat.

Depends on Phase 0 (the eval and the reply seam). Three changes, in order.

---

## Change `add-strudel-knowledge-corpus`

**Why.** Turn Strudel's own documentation into chunks, automatically,
with one taxonomy, pinned to the version the engine runs.

**Specs**
- **NEW capability `strudel-knowledge`** (purpose: the pipeline that
  turns Strudel's docs into searchable chunks). Requirements to cover:
  - source is the `refers_to/strudel` submodule at its pinned commit;
    the command fails clearly if the submodule is not initialised
    (`git submodule update --init --depth 1 refers_to/strudel`);
  - **chunk schema**: `id` (stable), `kind` (`function`, `concept`,
    `example`), `title`, `category`, `tags`, `text`, `source_url` (path at
    the pinned commit), `license` (AGPL-3.0), `version` (the submodule
    commit and the Strudel package version), plus for functions the
    `synonyms`, `params` and `examples`;
  - the **refresh command** `npm run knowledge:refresh` regenerates one
    committed chunk file deterministically (same input, byte-identical
    output) and never runs in deploy or CI;
  - **doc examples are validated**: each example is evaluated with the
    headless evaluator, and failures are reported (not silently dropped);
  - **Strudel's own snapshot** of each example's events is compared with
    ours as a parity check, and mismatches are reported;
  - `undocumented.json` (in the submodule) is read to report which
    exports have no docs.

**Extraction**
1. **Function chunks** from JSDoc. Run Strudel's own `jsdoc` + `jsdoc-json`
   with `jsdoc/jsdoc.config.json` from the submodule against its
   `packages/` (add `jsdoc` and `jsdoc-json` as dev dependencies of this
   repo, or run them in place — decide in `design.md`). Each entry has
   `@name`, `@param`, `@synonyms`, `@example`, `@memberof`. Collapse
   synonyms into the one chunk.
2. **Category from the site structure.** Parse the MDX pages under
   `website/src/pages/` — `learn/`, `recipes/`, `understand/`,
   `technical-manual/`, `workshop/` (skip `de/`). The page title is the
   category; an `## heading` followed by `<JsDoc name="Pattern.slow" />`
   assigns that function to the page's category. Functions no page
   mentions fall back to their `@memberof` or source file.
3. **Concept chunks** from the prose sections of those pages, split by
   heading; strip MDX imports and components; keep code blocks.
4. **Example chunks** from code blocks and `<MiniRepl>` examples.
5. Snapshots: `test/__snapshots__/examples.test.mjs.snap` in the
   submodule maps each doc example to the events it produces.

The corpus is small (about 500 documented functions and about 60 pages,
roughly 100k tokens), so no clever splitting is needed: cut along the
existing seams.

**Touch points.** New `scripts/knowledge/` (extract, chunk, refresh),
the committed output file (location decided in `design.md`),
`package.json` script, reuse of `scripts/patterns/lib/triage.mjs`.

**Tests.** `scripts/**/*.test.mjs` with fixture JSDoc and MDX (the
submodule is not present in CI): schema, determinism, category
assignment, MDX stripping, example validation reporting.

**Out of scope.** Loading anywhere, retrieval, `@jah` changes.

---

## Change `add-knowledge-store`

**Why.** The chunks must be readable at runtime.

**Specs**
- **MODIFIES `strudel-knowledge`**: the chunk file's contents are held in
  D1 (chunk text and metadata), and can be rebuilt from the file at any
  time.

**Design questions to settle (README Open Decisions 1–2).** Whether the
load runs on deploy when the file changed (idempotent, keyed by content
hash — the way `scripts/sync-patterns.mjs` treats patterns) or as part of
`knowledge:refresh`; whether a vector index exists at all yet. Ask the
developer about the first. If an index is added, keep the text in D1 and
only ids and vectors in the index; use separate dev and prod indexes;
never let local dev or CI touch prod; add a stub for tests.

**Touch points.** A new migration `0009_…` (or `0010_…` if Phase 0 used
`0009`) in `migrations/patterns/`; `scripts/deploy.mjs` and
`db:migrate:local` if the load runs there; `wrangler.jsonc` bindings if an
index is added.

**Tests.** Load is idempotent; a changed chunk updates, a removed chunk is
removed; `npm test` (which runs `db:migrate:local`) stays green offline.

---

## Change `add-jah-knowledge-retrieval`

**Why.** Use the chunks in replies.

**Specs**
- **MODIFIES `jah-grounding`**: for a mention, retrieve relevant chunks and
  supply them as context blocks. Two modes: **lookup by name** (a function
  named in the question resolves directly to its chunk, including via its
  synonyms) and **meaning-based search** for vague questions. The system
  prompt tells the model to answer from the supplied reference and say so
  when the reference does not cover the question.
- **MODIFIES `jah-chat`**: a reply carries its sources, and they are shown
  in the chat as links to their origin.
- Consider an always-present **compact index** (name, synonyms, one-line
  description for every function, roughly 8–10k tokens) in the prompt, so
  the model can name functions that exist and retrieval fetches the
  detail. Adopt it only if the eval shows it helps.

**UX.** The sources display (chips or a list under the reply) is a UI
decision — **discuss with the developer first** (README Open Decision 6).

**Touch points.** `server/jah/*`, `handleJahMention`, the chat rendering
in `app/pages/app/composition/[id].vue`, `shared/compositionProtocol.ts`
(`ChatMessage` gains optional sources), the stub flag from Phase 0.

**Tests.** Lookup by name and by synonym; search fallback; no-match path;
sources shown; `JAH_E2E`-style stub so no real model or index is used.
Re-run the eval and record the result.
