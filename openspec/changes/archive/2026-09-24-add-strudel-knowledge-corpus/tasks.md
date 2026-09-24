## 1. Scaffolding and fixtures

- [x] 1.1 `scripts/knowledge/__fixtures__/`: a small JSDoc source file with a
      documented function (`@name`, `@param`, `@synonyms`, `@tags`,
      `@example`), one with no docs at all, and a `doc.json`-shaped fixture
      object built from it (hand-written, mirrors what `jsdoc-json` would
      produce per `website/src/docs/JsDoc.jsx`'s consumption of it).
- [x] 1.2 `scripts/knowledge/__fixtures__/pages/`: fixture `.mdx` strings
      covering the shapes design.md decision 4 lists — a page presenting
      functions via `<JsDoc name="..." h={0} />`, a page with prose and a
      fenced code example, a page with a `<MiniRepl tune={`...`} />`
      example, and one page shaped oddly enough to trigger the "warn, don't
      guess" path.
- [x] 1.3 `package.json`: add `"knowledge:refresh": "node scripts/knowledge/refresh.mjs"`.

## 2. Submodule handling

- [x] 2.1 `lib/submodule.mjs`: check whether `refers_to/strudel` is
      initialized and at the commit `.gitmodules`/its own gitlink pin;
      `ensureSubmodule()` runs `git submodule update --init --depth 1 --
      refers_to/strudel` when it isn't, and fails with a clear message if
      git itself is unavailable. Injectable `git`/`fs` calls so tests never
      touch the real submodule or network. Tests: already-current (no-op),
      needs update, git failure.
- [x] 2.2 `lib/submodule.mjs`: `ensureJsdocTooling()` checks whether
      `jsdoc-json` resolves inside the submodule's own `node_modules` and
      runs `npm install` there (scoped, `--no-save`) only if it doesn't,
      memoized so a second call in the same run is a no-op. Tests with an
      injected resolver/exec.

## 3. JSDoc extraction

- [x] 3.1 `lib/jsdoc.mjs`: `extractDoclets(submodulePath, { exec, tmpDir })`
      shells out to the submodule's own `jsdoc`/`jsdoc-json` (absolute
      paths, its own `jsdoc/jsdoc.config.json`), writes `doc.json` to the
      OS temp directory, reads it back, and returns the doclets with
      `name`, `longname`, `description`, `synonyms`, `tags`, `params`,
      `examples`, `memberof`, and a source path derived from
      `meta.filename`/`meta.path`. Tests inject a fake `exec` returning the
      fixture `doc.json` from 1.1, asserting the exact command invoked
      (absolute paths, the submodule's config file) without actually
      running `jsdoc`.
- [x] 3.2 Malformed or missing `doc.json` (the extraction command fails, or
      produces unparsable JSON) is reported clearly and stops the run
      rather than producing a corpus with silently-missing functions. Test.

## 4. Page parsing

- [x] 4.1 `lib/pages.mjs`: `parsePage(filePath, mdxText)` — strip
      frontmatter (capture `title`), strip import lines, split into
      sections by heading, and for each section return either a
      `{ kind: 'category', functionName, category }` association (from a
      `<JsDoc name="...">` tag) or a `{ kind: 'concept', ... }` /
      `{ kind: 'example', ... }` chunk candidate (prose/fenced-code/
      `<MiniRepl>` sections). Tests against every fixture from 1.2,
      including the odd-shaped one producing a warning, not a thrown error
      or a wrong chunk.
- [x] 4.2 `listPages(submodulePath)`: every `*.mdx` under
      `website/src/pages/{learn,recipes,understand,technical-manual,
      workshop}/` and `website/src/pages/functions/`, excluding `de/`, in a
      fixed sorted order (determinism for the "first page wins" category
      rule). Test the exclusion and the ordering with a fixture directory
      tree.
- [x] 4.3 `buildCategoryMap(pages)`: function name → category, first page
      in sorted order wins on a repeat, logged (not an error) when it
      happens. Test the tie-break.

## 5. Chunk assembly

- [x] 5.1 `lib/chunks.mjs`: `buildFunctionChunks(doclets, categoryMap)` —
      the shared schema (id = doclet name, kind `function`, category from
      the map or a slugified `memberof`/file fallback flagged as a gap,
      tags from the doclet's own `@tags`, synonyms, params, examples,
      source_url/license/version per decision 8). Tests: categorized, page-
      less (fallback + gap), synonyms present, a duplicate id reported not
      silently overwritten.
- [x] 5.2 `buildConceptAndExampleChunks(pageResults)` — the concept/example
      candidates from 4.1 turned into the same shared schema (ids per
      design.md decision 8's slug scheme). Test id collisions across pages
      are reported.
- [x] 5.3 `assembleCorpus(...)` composes 5.1+5.2 into one chunk list ready
      for validation and writing.

## 6. Validation

- [x] 6.1 `lib/validate.mjs`: `checkPlayability(chunk, triage)` — evaluate
      every example in a function chunk (and every example chunk) with an
      injected triage-shaped `{ check }`, mapping its `pass`/`missing-
      sounds`/`error`/`inconclusive` into a validation report entry (or
      none, when it passes clean). Tests with a fake triage covering each
      status.
- [x] 6.2 `checkAgainstStrudelSnapshot(chunk, exampleIndex, snapshotText,
      queryFn)` — builds the same key format Strudel's own
      `test/examples.test.mjs` uses (`example "<name>" example index <i>`),
      looks it up in a parsed snapshot file, evaluates the example the same
      way (`Hap.show(true)`, 4 cycles) via an injected query function, and
      reports a mismatch or a missing snapshot entry. Reuses the
      `skippedExamples` list from `refers_to/strudel/test/examples.test.mjs`
      (copied in as a small constant, with a comment pointing at its
      source, so it doesn't silently drift unnoticed if Strudel's list
      changes — a mismatch there is a documentation detail to notice, not
      a load-bearing contract). Tests: a match, a mismatch, a name on the
      skip list is not compared (but is still checked by 6.1), no snapshot
      entry at all.
- [x] 6.3 A tiny snapshot-file parser for the vitest snapshot format (`exports[
      \`key\`] = \`value\`;`) — only what's needed to read the specific keys
      this needs, not a general vitest-snapshot reader. Test against a
      fixture snippet shaped like the real file.
- [x] 6.4 `validateCorpus(chunks, { triage, snapshotText })` ties 6.1-6.3
      together into the run's `validation[]` report list, and confirms
      every entry names the example and the specific issue (never a bare
      "failed").

## 7. Gaps and output

- [x] 7.1 `lib/gaps.mjs`: read the submodule's `undocumented.json` as-is
      into the report's `gaps[]` (plus the category-fallback gaps from
      5.1). Test on a fixture `undocumented.json`.
- [x] 7.2 `lib/write.mjs`: `serializeCorpus(...)` — sorts chunks by
      `(kind, id)`, stable key order, pretty-printed, trailing newline;
      `writeCorpus(path, data)`. Test: two calls with the same input
      produce byte-identical output (the determinism guarantee design.md
      decision 8 makes).

## 8. The orchestrator and a real run

- [x] 8.1 `refresh.mjs`: wires 2→3→4/5→6→7 in order per design.md decision
      9, with `--skip-submodule-update` and `--out`; prints the summary
      (chunk counts by kind, gap count, validation issue count). Not part
      of `npm test`.
- [x] 8.2 Run `npm run knowledge:refresh` for real (this does the one-time
      `refers_to/strudel` `git submodule update --init` and its own
      `npm install` — both are one-time, no ongoing cost). Read the
      printed summary; if the validation section shows real engine gaps
      (a doc example failing here the way `.piano()` did), report them —
      fixing an engine gap is out of scope for this change unless the
      developer asks otherwise.
- [x] 8.3 Inspect the committed `content/knowledge/strudel.json` diff by
      hand: spot-check a handful of function chunks against the live
      strudel.cc docs for the same function, spot-check a concept chunk's
      text reads sensibly with its source components stripped, and confirm
      the file is reasonably sized for a single commit.

## 9. Verification

- [x] 9.1 `npm run test:scripts` passes, entirely offline, with
      `refers_to/strudel` NOT required to be present (verify this
      literally: run the tests in an environment where the submodule
      directory is empty, or temporarily rename it, and confirm nothing
      fails).
- [x] 9.2 `npm test` and `npm run typecheck` are green.
- [x] 9.3 `openspec validate add-strudel-knowledge-corpus --strict`.
- [x] 9.4 After the developer's review: sync the `strudel-knowledge` spec
      into `openspec/specs/` and archive.
