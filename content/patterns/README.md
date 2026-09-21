# Curated pattern manifest

One file per curated Strudel pattern. This directory **is** the pattern
library's curated catalog — `npm run deploy` reconciles `PATTERNS_DB`
to match it (insert new, update changed, remove deleted), and unit
tests / local dev seed from it too. Do not add curated patterns via SQL
migrations any more.

## File format

`content/patterns/<id>.md` — the filename stem is the pattern's stable
id (kebab-case; the migrated starter set keeps its `seed-` prefix).
Frontmatter, then exactly one fenced code block with the pattern code:

    ---
    title: Four on the floor
    tags: [drums, house, beginner]
    source_url: https://strudel.cc/workshop/first-sounds/
    source_author: Alice        # optional
    description: A plain 4/4 kick with off-beat hats.   # optional
    favorite: false             # optional, defaults to false
    ---

    ```strudel
    s("bd*4, [~ hh]*4, ~ cp")
    ```

- **title** — required, non-empty.
- **source_url** — required. An entry with no source is rejected and
  the whole sync aborts (attribution is not optional).
- **tags** — optional list of strings; defaults to none.
- **source_author** — optional.
- **description** — optional; reserved for later (docs ↔ pattern
  context). Ignored today.
- **created_at** — optional ISO-8601. Omit it and the sync derives a
  deterministic value from the id-sorted position, matching the
  original seed convention. Existing rows keep whatever `created_at`
  they already have — the sync never rewrites it.
- **favorite** — optional boolean, defaults to `false`. A pattern with
  `favorite: true` is eligible to appear in the Composition Room's
  starter picker (still gated to patterns, not a separate system —
  see `add-favorite-patterns`). Long-form patterns meant as starters
  typically also carry a `starter` tag so they're identifiable in the
  general catalog grid too.
- **body** — exactly one fenced code block (```` ```strudel ```` or a
  bare fence) holding the pattern code. Nothing else in the body is
  read.

## Adding a pattern

**With the `add-patterns` skill (recommended).** Give Claude Code a concrete
source — a strudel.cc link (`#code` or `?short`), a raw/gist/GitHub file, a
GitHub repository or directory, a documentation page, a local file, or pasted
code with where it came from — and ask it to add the pattern(s). It resolves
the source, asks about attribution when it is unclear, checks that each
pattern plays, and shows one review of exactly what will happen. Once you
approve it, it writes the files, commits them and pushes (CI runs the tests and
deploys), then reports and stops. It will not go looking for
sources: an open-ended "add some songs by X" gets a request for a link.

The pieces are ordinary scripts you can run yourself:

- `npm run pattern:resolve -- <source>` — source → candidates (JSON), writes nothing
- `npm run pattern:check -- --candidates <file.json>` — the playback gate
  (`--fast` for a Node-only triage that is not a gate)
- `npm run pattern:write -- <spec.json> [--update]` — write the files
- `npm run pattern:tags` — the tags already in use

**By hand.** Add `content/patterns/<id>.md` as above, keep the code exactly as
found (comments and formatting included), record the source URL, then run
`npm run patterns:sync` to see it locally. Whichever way, run the playback
spec before pushing — CI (`npm test`) does not run Playwright, so a pattern
that asks for a sound that isn't loaded would ship silent:

    npm run test:e2e -- e2e/pattern-playback.spec.ts

(Set `PATTERN_IDS=id1,id2` to check only some.) A pattern that uses a pack
outside the default sample map must load it in its own code, e.g.
`samples('github:yaxu/clean-breaks/main')` for `amen`, so it also plays on
strudel.cc.

## Reconcile semantics

- Rows are matched by id. Present in the manifest → upserted. Absent
  from the manifest but `origin = 'curated'` in the DB → deleted with
  their tags.
- Rows with `origin = 'user'` (future user-authored patterns) are never
  touched, listed in the manifest or not.
- Running the sync twice with an unchanged manifest changes nothing.

Re-run by hand against local D1: `npm run patterns:sync` (add
`-- --remote` to hit production, which `npm run deploy` does anyway).
