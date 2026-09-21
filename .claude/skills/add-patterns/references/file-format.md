# The pattern file

`content/patterns/<id>.md` — YAML front matter, then one fenced code block.
The filename stem is the pattern's **id** (kebab-case). It is also the id in
the database, in `?load=<id>` links and in `/api/patterns/<id>`, so it never
changes once a pattern exists: a rename is a delete plus an add and breaks
those links.

```
---
title: Four on the floor
tags: [drums, house]
source_url: https://strudel.cc/#...
source_author: Alice          # optional
favorite: true                # optional, defaults to false
created_at: 2026-09-21T00:00:00.000Z   # optional
---

```strudel
s("bd*4, [~ hh]*4, ~ cp")
```
```

Only the first `strudel` / `js` / bare fenced block is read. `source_url` is
required — a file without one aborts the whole reconcile.

## What `pattern:write` guarantees

- **Code is verbatim.** Comments, header blocks (`@title`, `@by`, `@license`),
  indentation and blank lines stay. Only line endings become LF and blank
  lines/whitespace at the very start and end are trimmed. A first line's own
  indentation is kept.
- **The fence is longer than any backtick run in the code**, so code that
  contains a line of triple backticks is stored and read back whole (the
  manifest reader matches the opening fence's length).
- **YAML is emitted by a real serialiser** (titles with `:`, quotes, `#` are
  quoted correctly); tags use the `[a, b]` flow style like the existing files.
- **A new file gets `created_at`** = now (a batch keeps its order); an update
  keeps the existing one. Existing rows never have `created_at` rewritten.
- **The whole manifest is re-read after every write**; if the new file would
  make it invalid it is rolled back and reported.
- **Identity by source URL**: same source → same entry (`unchanged` if nothing
  differs, `would-update` / `updated` if it does), keeping its id.

## Reconcile (what happens after)

Every deploy reconciles the database to the files: new → inserted, edited →
updated (tags rebuilt), deleted → removed; only `origin='curated'` rows are
touched; one invalid file aborts everything. Deploying is commit + push: a
push to `main` makes Workers Builds run `npm test` and then `npm run deploy`,
which reconciles the **pushed** files. The skill's Ship step commits and pushes;
it never runs the deploy script by hand. (A local `npm run deploy` reads the
working tree instead, so it would carry uncommitted files too — one reason not
to use it here.)
