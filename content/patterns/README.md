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
- **body** — exactly one fenced code block (```` ```strudel ```` or a
  bare fence) holding the pattern code. Nothing else in the body is
  read.

## Reconcile semantics

- Rows are matched by id. Present in the manifest → upserted. Absent
  from the manifest but `origin = 'curated'` in the DB → deleted with
  their tags.
- Rows with `origin = 'user'` (future user-authored patterns) are never
  touched, listed in the manifest or not.
- Running the sync twice with an unchanged manifest changes nothing.

Re-run by hand against local D1: `npm run patterns:sync` (add
`-- --remote` to hit production, which `npm run deploy` does anyway).
