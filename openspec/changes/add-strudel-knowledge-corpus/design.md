## Context

See `proposal.md` for why. This is Phase 1 of `docs/04-roadmap/jah-intelligence/`
(read its `README.md` for decisions already taken); it produces the corpus
that `add-knowledge-store` (load into D1/an index) and
`add-jah-knowledge-retrieval` (use it in replies) build on. Nothing here
changes `@jah`.

**Verified facts about `refers_to/strudel`** (a shallow sparse clone at the
pinned commit `8f81463`, matching the submodule's pin and the installed
`@strudel/core@1.2.6` / `@strudel/webaudio@1.3.0` / `@strudel/codemirror@1.3.0`):

- `package.json` scripts: `"jsdoc": "jsdoc packages/ -c jsdoc/jsdoc.config.json"`
  and `"jsdoc-json": "jsdoc packages/ --template ./node_modules/jsdoc-json
  --destination doc.json -c jsdoc/jsdoc.config.json"`, with `jsdoc@^4.0.4`
  and `jsdoc-json@^2.0.2` as its own dev dependencies.
- `jsdoc/jsdoc.config.json` — `{ source: { includePattern, excludePattern },
  plugins: ["plugins/markdown", "jsdoc/jsdoc-synonyms"], opts: { destination:
  "./out/", recurse: true } }`. `jsdoc/jsdoc-synonyms.js` is a small custom
  plugin defining two tags: `@synonyms` (space/comma-separated alternate
  names, stored as `synonyms_text` + `synonyms[]`) and **`@tags`**
  (space/comma-separated keywords, stored as `tags[]`) — discovered while
  researching this change, and used on hundreds of functions (208 in
  `controls.mjs` alone, e.g. `s` is tagged `superdough, samples`). This is a
  better category/keyword signal than inferring purely from page placement.
- `doc.json`'s shape (from `website/src/docs/JsDoc.jsx`, which is the site's
  own consumer of it): `{ docs: [...] }`, each doclet keyed by `longname`,
  with `name`, `description` (HTML), `synonyms_text`/`synonyms`, `tags`,
  `params[]` (`name`, `type.names[]`, `description`), `examples[]` (raw
  code strings), `memberof`.
- Documentation pages live at `website/src/pages/{learn,recipes,understand,
  technical-manual,workshop}/*.mdx` (30 + 12 + 3 + 7 + 4 files respectively;
  `functions/` has 2 more), plus a `de/` German translation tree to exclude.
  A typical page: YAML-ish frontmatter (`title`, `layout`) between `---`
  lines, `import { MiniRepl } from '...'` / `import { JsDoc } from '...'`
  lines, a `# Title` heading, then a mix of prose, fenced code blocks,
  `<MiniRepl client:idle tune={`...`} />` (or `tune={"..."}`) blocks, and
  `<JsDoc client:idle name="Pattern.slow" h={0} />` self-closing tags that
  render one function's doc inline.
- `undocumented.json` (produced by the submodule's own `report-undocumented`
  script, already present in the repo, not something this change generates)
  lists exports with no JSDoc, keyed by file path.
- `test/__snapshots__/examples.test.mjs.snap` and the test that produces it
  (`test/examples.test.mjs` + `test/runtime.mjs`) — see decision 6.

## Goals / Non-Goals

**Goals:**
- Produce a committed, versioned, attributed corpus from Strudel's own
  documentation, with no scraping and no hand curation.
- Make every doc example's playability here a checked fact, not an
  assumption, and surface every gap (undocumented exports, examples that
  don't evaluate, examples that evaluate differently than Strudel's own
  records) rather than hiding them.
- Keep the pipeline's own tests independent of the submodule being present
  (fresh clones and CI never initialize it).

**Non-Goals:**
- Loading chunks anywhere a query can reach them (`add-knowledge-store`).
- Any change to `@jah`'s prompt, retrieval, or replies
  (`add-jah-knowledge-retrieval`).
- A general-purpose MDX/Astro renderer. The pages are parsed just enough to
  recover categories, prose, and example code — not to render them.
- Localized (`de/`) documentation.
- Perfect fidelity to strudel.cc's rendering (e.g. `{@link}` resolution in
  descriptions) — the text is for grounding a model's answer, not for
  display.

## Decisions

### 1. Layout

```
scripts/knowledge/
  refresh.mjs             CLI: the whole pipeline, end to end
  lib/
    submodule.mjs          ensure refers_to/strudel is at its pinned commit
    jsdoc.mjs               run the submodule's own jsdoc-json, parse doc.json
    pages.mjs                parse the MDX pages: categories, concept/example chunks
    chunks.mjs               assemble the shared-schema chunks from the above
    validate.mjs             evaluate every example; compare with Strudel's snapshot
    gaps.mjs                 read undocumented.json into the report shape
    write.mjs                serialize the committed output deterministically
  __fixtures__/             small hand-written JSDoc/MDX fixtures for tests
  *.test.mjs                beside each lib file
content/knowledge/
  strudel.json              the committed output (decision 8)
```

Under `scripts/`, alongside `scripts/patterns/`, for the same reason: a
developer tool, found by the existing `test:scripts` glob. `package.json`
gains `"knowledge:refresh": "node scripts/knowledge/refresh.mjs"`.

### 2. The submodule is ensured, never assumed

`lib/submodule.mjs` checks whether `refers_to/strudel/package.json` exists
and, via `git submodule status`, whether it's at the commit `.gitmodules`
(and the submodule's own gitlink) pin. If not, it runs `git submodule update
--init --depth 1 -- refers_to/strudel` (matching how `test/composition.test.ts`
and the pattern-ingestion skill treat similar setup steps: do the deterministic
thing, don't ask). `refresh.mjs` calls this first and fails with a clear
message if git itself is unavailable — it never silently proceeds against a
missing or stale checkout (spec: "The Corpus Is Built From The Pinned
Submodule, Never Scraped").

### 3. JSDoc extraction shells out to the submodule's own tooling

**Corrected against the real submodule during implementation** (three
things this decision originally got wrong, each verified by actually
running it — recorded here rather than pretending the first draft was
exactly right):

- **`refers_to/strudel`'s own root `package.json` is a pnpm workspace**
  whose internal packages reference each other via the `workspace:*`
  protocol, which plain `npm install` cannot parse *at all* — it fails
  with `EUNSUPPORTEDPROTOCOL` even when installing one unrelated package,
  because npm reads and validates the whole ambient `package.json` first.
  So `jsdoc`/`jsdoc-json` are **not** installed into the submodule's own
  `node_modules`; `submodule.mjs`'s `ensureJsdocTooling` installs them into
  an isolated `refers_to/strudel/.jsdoc-tools/` subdirectory with its own
  minimal `package.json` (`{ name, private: true }`, created once), so npm
  never has to see the submodule's real one. The version ranges still come
  from the submodule's own root `package.json` `devDependencies`, so this
  still runs *exactly* the tool version Strudel's own docs are built with
  — only where the install lands changed, not which versions.
- **`node_modules/.bin/jsdoc` is a POSIX shell shim**, not something
  `execFile` can run directly on every platform (it threw a JS syntax
  error under plain `execFile` on Windows, and a separate `EINVAL` when
  invoking the platform's `.cmd` wrapper directly). `jsdoc.mjs` instead
  runs the package's real entry point, `<tools>/node_modules/jsdoc/jsdoc.js`,
  through `node` (`cmd: process.execPath`) — portable, no shell involved.
- **Every path passed to the command is resolved to a genuinely absolute
  path** (not just `path.join`, which stays relative if its inputs are).
  This matters because the invocation also needs `cwd: <submodulePath>` —
  `jsdoc.config.json`'s own `"jsdoc/jsdoc-synonyms"` plugin entry is a
  specifier jsdoc resolves relative to the process's cwd, exactly like the
  submodule's own `npm run jsdoc-json` script (which always runs from the
  submodule root); running from any other cwd fails with "Unable to find
  the plugin". A relative arg combined with that cwd would double up
  (`refers_to/strudel/refers_to/strudel/...`) — genuinely absolute args
  sidestep that regardless of cwd.

None of this changes the shape of what's extracted, only how the command
is invoked — the earlier bullet about not vendoring our own `jsdoc`/
`jsdoc-json` still holds, we just install them somewhere the submodule's
own dependency graph can't interfere with.

`doc.json` itself is written to the OS temp directory, not committed — it's
regenerable from the submodule and is a different (site-oriented) shape
than our chunk schema.

`lib/jsdoc.mjs` reads each doclet's `name`, `longname`, `description`
(left as the HTML JSDoc's markdown plugin produces — text good enough to
show a model, not to render), `synonyms`, `tags`, `params`, `examples`,
`memberof`. **`meta.path` is an absolute filesystem path** (confirmed
against real output — not relative, as an earlier draft assumed), so
`jsdoc.mjs` makes it relative to the submodule root itself before using it
for `source_url`, so the committed corpus never bakes in a machine-specific
path.

### 4. Pages are parsed with small, targeted regexes — no MDX/Astro dependency

`lib/pages.mjs` processes each `*.mdx` under the five English page
directories (`learn`, `recipes`, `understand`, `technical-manual`,
`workshop`; `functions/` folded in too — all under `website/src/pages/`,
explicitly excluding `de/`):

1. Strip YAML-ish frontmatter (text between the first two `---` lines);
   take `title` from it as the page's category.
2. Strip `import { ... } from '...'` lines.
3. Split the remainder by heading (`^#{1,3}\s+`), keeping each heading with
   the text until the next heading.
4. Within a section, find every `<JsDoc\s[^>]*name=["']([^"']+)["']` and
   record `functionName → pageCategory` (first page wins if a function
   appears on more than one — logged, not an error; deterministic because
   pages are processed in a fixed sorted order).
5. A section with no `<JsDoc>` tag becomes a **concept chunk**: its heading
   is the title, its category is the page's title, its text is the
   remaining prose with `<MiniRepl ...>`, `<img ...>`, and other leftover
   JSX-looking tags stripped (a fenced code block ` ```...``` ` is left
   verbatim), and every `<MiniRepl ... tune={`...`}\s*/>` (backtick or
   quoted string) or fenced code block inside it additionally becomes an
   **example chunk**, `source_url` pointing at the same page and heading.

This is the same kind of hand-written, fence-aware parsing the pattern
manifest reader already does (`scripts/lib/patterns-manifest.mjs`), chosen
for the same reason: the actual shape in use is narrow and known, and a
general MDX/Astro/JSX parser is a large dependency for a narrow need. A
page whose shape doesn't match these assumptions produces a warning in the
run's report (not a silent skip and not a hard failure) so a genuinely odd
page gets a human look rather than a wrong chunk.

**Corrected against the real pages**: they are CRLF (confirmed —
`website/src/pages/**/*.mdx` uses `\r\n` throughout), and every regex
above assumes bare `\n`. Without normalizing first, frontmatter title
extraction (and everything downstream of it) silently failed on every
real page — caught by running the real pipeline, not by the fixture
tests (which were, understandably, written with `\n`). `parsePage` now
normalizes `\r\n` → `\n` as its first step, and a fixture test pins this
by parsing a CRLF copy of an existing fixture and asserting it produces
the same result as the LF original.

### 5. Category and tags: page structure for category, `@tags` for keywords

A function's `category` is the page category from step 4 above, falling
back to a slugified `memberof` or source file name when no page presents
it — and that fallback case is always listed in the run's report as a
gap (spec: "A Function's Category Comes From The Documentation Site's Own
Structure"). A function's `tags` are its own `@tags` doclet field
(decision — discovered fact 2 above), giving finer-grained, Strudel-
maintained keywords independent of page placement; a function with no
`@tags` simply has an empty tag list, which is not a gap (most functions
predate the `@tags` convention).

### 6. Validating examples: two independent checks, not one conflated one

Every function's `examples[]` and every extracted example chunk is
evaluated with the same headless evaluator `pattern:check --fast` and the
eval harness use (`createTriage` from `scripts/patterns/lib/triage.mjs`).
This is always run and is the primary "does this actually play in *our*
app" signal — the same contract the curated pattern library and the eval
harness already rely on.

Separately, where Strudel's own recorded output exists, an **exact
comparison** is attempted: `refers_to/strudel/test/__snapshots__/
examples.test.mjs.snap` keys are `example "<doclet.name>" example index
<i>` (verified against `refers_to/strudel/test/examples.test.mjs`, whose
`doc.examples.forEach((example, i)) => queryCode(example, 4)` — 4 cycles,
`.map(h => h.show(true))` — is exactly how each snapshot value was
produced). `validate.mjs` evaluates the same example the same way (`@strudel/
core`'s own `Hap.show(true)`, 4 cycles) and diffs the result against the
snapshot text.

Strudel's own test (`test/examples.test.mjs`) **skips a fixed list of
examples** entirely (device-motion/orientation, gamepad, `clearScope`,
`defaultmidimap`, `midimaps`, `bmod`) because they need browser or hardware
APIs their Node test runtime can't provide either. This pipeline mirrors
that same skip list for the *exact-snapshot* comparison (Strudel itself
has no ground truth for them), but still runs the primary triage check on
them, since whether *our* app can play them is still a fact worth knowing.

Their test runtime (`test/runtime.mjs`) also mocks a broader set of
no-op methods than our `triage.mjs`'s `WIDGETS` list (`tone`, `webdirt`,
`wave`, `filter`, `adsr`, `webaudio`, `soundfont`, `tune`, `midi`, `dough`,
among others) — because their test environment, like ours, is headless
Node. A discrepancy caused by one of *those* names is a genuine
"this example doesn't play in a plain evaluator" fact, worth surfacing
exactly as `.piano()` was — not swallowed as a test-harness artifact.
`validate.mjs` does not adopt their mock list; it reports what our real
`triage.mjs` (which mirrors the app's real `prebake.ts`) actually does,
by design (spec: "reported by the example's name and location, and SHALL
NOT be silently excluded... or silently treated as passing").

Every discrepancy — a triage failure, a missing-sound result, or a
mismatch against Strudel's recorded snapshot — is collected into the run's
`validation` report entries, keyed by function/example name, and the
example is **still included** in the corpus (a broken official example is
still real, attributed documentation; hiding it would misrepresent
coverage).

### 7. Gaps: pass through, don't recompute

`lib/gaps.mjs` reads the submodule's already-committed `undocumented.json`
(built by Strudel's own `report-undocumented` script) as-is into the run's
report. This repo does not regenerate it — recomputing "what jsdoc failed
to document" from our own extraction would risk disagreeing with Strudel's
own accounting for no benefit.

### 8. Output: one committed file, deterministic ordering

`content/knowledge/strudel.json` — chosen over per-chunk files because
nobody hand-edits these chunks (unlike `content/patterns/*.md`, which is
also why the pattern library uses one-file-per-entry); a single file keeps
the "committed diff is the changelog" property the roadmap asks for
without four hundred file adds on first run. Verified safe: `content/`
already holds non-`@nuxt/content` data (`content/patterns/*.md`, read
directly by `scripts/sync-patterns.mjs`, not through `@nuxt/content`);
`content.config.ts`'s collections are scoped by explicit `source` globs
(`docs/**/*.md`, `articles/*.md`) that don't reach `knowledge/`, so this
new file cannot be swept into a collection by accident.

Shape:
```json
{
  "generatedAt": "2026-...",
  "submoduleCommit": "8f81463...",
  "strudelVersions": { "core": "1.2.6", "webaudio": "1.3.0", "codemirror": "1.3.0" },
  "chunks": [ { "id": "...", "kind": "function", "title": "...", "category": "...",
                "tags": [], "text": "...", "sourceUrl": "...", "license": "AGPL-3.0",
                "version": "8f81463", "synonyms": [], "params": [], "examples": [] } ],
  "gaps": [ "path/to/file.mjs: exportedName", ... ],
  "validation": [ { "example": "rev example index 0", "issue": "mismatch"|"error"|"missing-sounds",
                     "detail": "..." } ]
}
```
`write.mjs` sorts `chunks` by `(kind, id)`, pretty-prints with a stable key
order, and writes with a trailing newline — so re-running `knowledge:refresh`
against an unchanged submodule produces a byte-identical file (a real diff
means something really changed), the same determinism property
`scripts/patterns/write.mjs` already guarantees for pattern files.

Chunk ids: functions use their doclet `name` (already unique in practice;
a collision is reported, not silently overwritten); concept/example chunks
use `<page-slug>-<heading-slug>` and `<page-slug>-<heading-slug>-example-<n>`.

### 9. `refresh.mjs` — the orchestrator

```
node scripts/knowledge/refresh.mjs [--skip-submodule-update] [--out <file>]
```
Runs, in order: ensure the submodule (2) → extract JSDoc (3) → parse pages
(4/5) → assemble chunks (per the shared schema) → validate every example
(6) → build the gaps report (7) → write the output (8) → print a summary
(chunk counts by kind, gap count, validation issue count). Never invoked
by `npm run deploy` or `npm test` (spec: "Refreshing Is A Deliberate,
Offline-Safe, Developer-Run Act").

### 10. Testing without the submodule

Every `lib/*.mjs` function takes its input as data or a path, never
assuming `refers_to/strudel` exists — `jsdoc.mjs` takes a `doc.json`-shaped
object (or a path to one) and a set of small **fixture** JSDoc source
files under `scripts/knowledge/__fixtures__/` stand in for the real
extraction in tests; `pages.mjs` is tested against a few hand-written
fixture `.mdx` strings covering the shapes in decision 4 (a `<JsDoc>` page,
a prose+example page, a page with `<MiniRepl>`, a malformed page that
should warn); `validate.mjs` is tested with a fake triage and fake
snapshot content, the same pattern the eval harness's `evaluate.test.mjs`
and `model-drift.test.mjs` established. `submodule.mjs` is tested by
injecting a fake `git`/`fs` layer, never by requiring the real submodule.
Only `refresh.mjs` itself (the orchestrator) needs the real submodule, and
it is never run by `npm test` or CI.

## Verified against the real submodule (task 8.2, 2026-09-22)

A real `npm run knowledge:refresh` (after `git submodule update --init`
and the one-time `.jsdoc-tools` install) against commit `8f81463`
produced `content/knowledge/strudel.json`: **566 function chunks, 341
concept chunks, 504 example chunks** (1,411 total, ~1.2 MB). Spot-checked
by hand: `rev` and `lpf`'s chunks (category, tags, synonyms, examples,
`sourceUrl`) match the real source; a concept chunk's prose reads
sensibly with its `<MiniRepl>`/component tags stripped. Two independent
runs produced byte-identical output apart from `generatedAt`, confirming
the determinism guarantee (decision 8) holds for real data, not just
fixtures.

Numbers this surfaced, none of them bugs — real facts about the corpus,
each reported rather than hidden per the spec's own requirements:
- **827 gaps**: mostly genuinely undocumented exports (per the submodule's
  own `undocumented.json`), plus a handful of functions absent from any
  documentation page (category derived from source instead).
- **~35 function-id collisions**, nearly all from `packages/supradough/
  dough.mjs` re-documenting names (`attack`, `decay`, `release`, `lpf`'s
  underlying controls, etc.) that `packages/core/controls.mjs` already
  documents at the pattern level. "First wins" (decision 1's id scheme)
  keeps the pattern-level doc in each case, because `core` sorts before
  `supradough` in jsdoc's own traversal — the outcome one would want, if
  incidentally so; not something this change relies on being guaranteed.
- **~6 category collisions** where a function is legitimately presented
  on two different pages (e.g. `clip` under both "Samples" and "Time
  Modifiers") — first page in `PAGE_DIRECTORIES` order wins, logged.
- **2 duplicate concept/example ids**, from two sections sharing the same
  heading text within one page (e.g. two "Usage" sections) — the id
  scheme (page + heading slug) isn't unique in that rare case; reported,
  first kept, nothing silently overwritten.
- **324 validation issues** out of 1,070 examples checked (function +
  example chunks) — a mix of genuine engine gaps (worth a future look, the
  same kind `.piano()` was), mini-notation edge cases triage's headless
  evaluator can't fully resolve, and examples needing browser-only
  behavior triage already documents as its own limitation. Not
  triaged item-by-item as part of this change — that's follow-up work,
  not a blocker for the corpus existing and being honest about its gaps.
- Concept prose can contain a few stray blank lines where a stripped
  `<MiniRepl>` used to sit inline in a sentence — reads sensibly, just not
  perfectly tidy; a cosmetic polish left for later, not a correctness
  issue.

## Risks / Trade-offs

- **[The submodule's own `npm install` is a real, if one-time, cost]** →
  It runs only inside `refers_to/strudel`, only once per fresh checkout
  (memoized), and only when a developer runs `knowledge:refresh` — never
  in CI or on a fresh clone that doesn't ask for it.
- **[Page-parsing regexes are brittle against a page shape we didn't
  see]** → A page that doesn't match assumptions produces a warning, not a
  wrong or silently dropped chunk (decision 4); the fixture tests pin the
  shapes seen while researching this change, but Strudel's own future
  pages can still surprise it — `knowledge:refresh`'s printed summary is
  where a developer would notice.
- **[Exact-snapshot comparison can flag examples that are fine in a real
  browser but need APIs headless Node lacks]** → Accepted and by design
  (decision 6): that is the same "triage is not the browser" trade-off the
  pattern-ingestion gate already documents, and the report distinguishes a
  triage failure/mismatch from a hard error so a developer can judge each
  one.
- **[`doc.json`'s HTML-ish descriptions are meant for the website, not a
  model prompt]** → Accepted for this change (extraction only); trimming
  or reformatting them for prompt use, if needed, belongs to
  `add-jah-knowledge-retrieval`, which knows what the model actually needs.
- **[Corpus size]** → Roughly 500 documented functions and ~60 pages;
  informally similar in order of magnitude to the ~100k-token estimate in
  the roadmap discussion. Not a concern for committing one JSON file; it
  may matter for `add-knowledge-store`'s loading step, out of scope here.
- **[License]** → Strudel is AGPL-3.0; every chunk records that license and
  its exact source path and commit (spec: "Every Chunk Records Its
  Attribution"). Chunks may be verbatim excerpts of Strudel's own
  documentation — that is the point of extracting "Strudel's own docs",
  not scraped or rewritten copies — and the recorded license/attribution
  is how that is handled honestly, per the developer's earlier "I don't
  mind attributing" decision. This is not legal advice.

## Migration Plan

Purely additive: new scripts, new dev-time submodule population, one new
committed data file, one new `package.json` script. No runtime code
changes, no migration, no deploy behavior change. Rollback is deleting
`scripts/knowledge/`, `content/knowledge/`, and the `package.json` entry;
the submodule stays registered (as it already was) regardless.

## Open Questions

- Should `refresh.mjs` also verify the installed `@strudel/*` package
  versions in this repo's own `node_modules` match the submodule's pinned
  versions, and warn on drift? Not required for this change to be useful,
  and easy to add later without touching the chunk schema or any spec
  requirement — deferred.
