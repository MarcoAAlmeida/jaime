## Why

`@jah`'s baseline (`scripts/jah-eval/baseline.json`, recorded 2026-09-22: 86%
overall) already shows the gap a hand-written cheat-sheet leaves: it has no
idea `.euclid()` or `.arp()` exist, because they simply aren't in
`server/jah/prompt.ts`. Growing the cheat-sheet by hand doesn't scale, and it
drifts from whatever Strudel version the app actually runs.

Strudel's own documentation already exists as structured data: every
documented function carries a JSDoc comment with `@name`, `@param`,
`@synonyms`, `@example`, and (discovered while researching this change) a
custom `@tags` annotation used on hundreds of functions — `s`, for example,
is tagged `superdough, samples`. The `refers_to/strudel` git submodule
(`docs/04-roadmap/jah-intelligence/README.md` decision 1) already pins the
exact commit matching the installed `@strudel/*` packages. Turning that into
a committed set of knowledge chunks needs no scraping and no hand curation —
it's an extraction pipeline over data Strudel's own maintainers keep
accurate, run once and refreshed rarely.

This is Phase 1 of `docs/04-roadmap/jah-intelligence/`, and it is
deliberately scoped to *producing* the corpus. Loading it into a runtime
store is `add-knowledge-store`; using it in `@jah`'s replies is
`add-jah-knowledge-retrieval`. Neither exists yet, and nothing here changes
what `@jah` says.

## What Changes

- **The `refers_to/strudel` submodule is initialized** at its pinned commit
  (`update = none` keeps it out of CI and ordinary clones).
- **`jsdoc` and `jsdoc-json` become dev dependencies here** (matching the
  versions the submodule's own `package.json` pins) and are run against the
  submodule's `packages/` with its own `jsdoc/jsdoc.config.json` — the exact
  pipeline that builds strudel.cc's own docs — producing `doc.json`: one
  doclet per documented function, with `params`, `examples`, `synonyms`
  (from a custom tag plugin), and now-discovered `tags`.
- **A chunk schema shared by function and concept knowledge**: `id`, `kind`
  (`function` | `concept` | `example`), `title`, `category`, `tags`, `text`,
  `source_url` (path at the pinned commit), `license` (`AGPL-3.0`),
  `version` (submodule commit + Strudel package version), and for `function`
  chunks: `synonyms`, `params`, `examples`.
- **Category comes from the documentation site's own structure**: the MDX
  pages under `website/src/pages/{learn,recipes,understand,technical-manual,
  workshop}/` (excluding `de/`) are mostly headings wrapping
  `<JsDoc name="..." />`; the page's title becomes a function's category. A
  function's `tags` come straight from its own `@tags` doclet field. A
  function neither placed on a page nor tagged falls back to its source
  file as category, and is listed as a gap, not silently dropped.
- **Concept chunks** from the prose sections of those same pages (split by
  heading, MDX imports/components stripped, code fences kept intact).
- **Example chunks** from `<MiniRepl>` blocks and fenced code in the prose,
  each recording its page as `source_url`.
- **A gaps report** from the submodule's own `undocumented.json` (exports
  with no JSDoc at all) — surfaced, never hidden.
- **`npm run knowledge:refresh`**: a deliberate, developer-run command
  (never invoked by `deploy` or CI) that updates the submodule if asked,
  regenerates `doc.json`, builds every chunk, validates them (below), and
  writes one committed, reviewable output. Its diff is what "Strudel docs
  changed" looks like in this repo.
- **Every function example, and every extracted example chunk, is
  validated two ways**: evaluated with the same headless evaluator
  `pattern:check --fast` and the eval harness use
  (`scripts/patterns/lib/triage.mjs`), and compared against Strudel's own
  recorded ground truth for that exact example
  (`refers_to/strudel/test/__snapshots__/examples.test.mjs.snap`, which
  gives the exact events an example produces). A mismatch is a real engine
  gap (the same kind `.piano()` was) and is reported by name, never
  silently excluded from the corpus.

## Capabilities

### New Capabilities
- `strudel-knowledge`: the pipeline that turns Strudel's own documentation
  (at a pinned submodule commit) into a versioned, attributed, validated set
  of knowledge chunks, refreshed only when a developer asks.

### Modified Capabilities
<!-- None. This change produces data and tooling; it does not touch any
     runtime behavior, so no existing spec's requirements change. -->

## Impact

- **New code:** `scripts/knowledge/` (submodule check, JSDoc extraction,
  MDX parsing, chunking, validation, the `knowledge:refresh` command), its
  tests (fixture JSDoc/MDX input — the real submodule is not available in
  CI or on a fresh clone), and the committed chunk output.
- **New dev dependencies:** `jsdoc`, `jsdoc-json` (versions matched to the
  submodule's own `package.json`).
- **Touched:** `package.json` (`knowledge:refresh` script); `vitest.config.ts`
  (excludes `refers_to/**` from vitest's own test discovery — found running
  the real pipeline: once the submodule is actually checked out, it's a
  real directory with its own unrelated test suite, which vitest's default
  glob otherwise sweeps up and runs, breaking `npm test` project-wide for
  anyone who has run `knowledge:refresh`); `scripts/patterns/lib/triage.mjs`
  gains one small additive export, `queryEvents` (reuses its existing,
  already-initialized Strudel engine to reproduce Strudel's own example
  test methodology exactly, rather than a second independent engine setup
  — no change to `check()` or any existing caller). `.gitmodules` is
  unchanged (already correct) but the submodule working tree becomes
  populated for anyone who runs the refresh.
- **Not touched:** any runtime code, `server/jah/*`, D1, any migration, the
  chat, `@jah`'s replies. No user-visible behavior changes.
- **Cost:** none at runtime; `knowledge:refresh` runs locally, no network
  cost beyond the one-time submodule fetch.
- **Depends on:** nothing in-flight. **Unblocks:** `add-knowledge-store` and
  `add-jah-knowledge-retrieval` (Phase 1's remaining changes).
