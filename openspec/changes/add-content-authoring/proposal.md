## Why

The Pattern library ships with ~20 hand-written SQL seed rows and the
Strudel docs section is a single placeholder page pointing at
strudel.cc. Phase 5 of the tools-hub roadmap is the content phase: grow
the curated library from [awesome-strudel](https://github.com/terryds/awesome-strudel)
and write real Strudel reference/guide content — with Claude drafting,
the maintainer reviewing (Journey 8, stories 56–59; Journey 6, stories
45–46). Doing this by adding more `INSERT` statements to migrations
does not scale: patterns end up buried in SQL, every edit needs a new
migration, and a reviewer can't diff the actual catalog. This change
puts the curated catalog in a version-controlled manifest that deploy
reconciles into the database, then authors the first real batch of
patterns and Strudel docs on top of it.

## What Changes

- **Curated patterns move to a version-controlled manifest.** A
  checked-in file (or set of files) is the single source of truth for
  every curated pattern — id, title, code, tags, source URL, optional
  author. `npm run deploy` reconciles `PATTERNS_DB` to the manifest:
  insert new entries, update changed ones, remove curated entries no
  longer listed. Non-curated (user-created) patterns are never touched.
- **Migration `0002`'s seed rows are migrated into the manifest** and
  its inserts made idempotent / superseded, so the two mechanisms don't
  fight. The `seed-*` id convention for curated rows is kept.
- **The curated library is expanded** ~20 → ~45 with a first real batch
  of short, remixable *starter* patterns (rhythms, basslines, synth
  textures, generative tricks) in the existing seed style — each
  carrying correct attribution from the moment it's authored (story
  59). Note: [awesome-strudel](https://github.com/terryds/awesome-strudel)
  turned out to be ~29 full-song covers (opaque `strudel.cc/?hash`
  links, hundreds of lines each) — whole compositions, not the "start
  here instead of a blank editor" snippet the library is for — so it is
  cited only where a pattern is genuinely derived from it; the batch is
  attributed mostly to the strudel.cc learn / workshop / examples pages
  each pattern demonstrates.
- **The Strudel docs section gets real content**: the single
  placeholder page becomes a small set of real reference/guide pages
  (mini-notation, sound sources, effects, the subset JAM supports),
  with the `placeholder: true` flag dropped for Strudel. Ordinary
  markdown links from docs pages to relevant library patterns.
- **Out of scope, noted for a later change:** full-text docs search
  (story 47), Hydra / TidalCycles docs (stories 49, 57 — "once
  written"), and any in-app pattern-authoring UI (domain-model
  decision 7 keeps authoring a Claude-assisted process, not a modeled
  feature).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pattern-library`: add a requirement that the curated catalog is
  defined by a version-controlled manifest which deploy reconciles into
  the database (idempotent upsert + removal of dropped curated entries,
  leaving non-curated patterns intact). The existing "Catalog Persists
  Across Deploys" and attribution requirements are unchanged in intent
  but the population mechanism they assume shifts from seed migrations
  to the manifest.

## Impact

- **New**: a `content/patterns/` manifest (format decided in
  `design.md`), a sync/reconcile step invoked by `scripts/deploy.mjs`
  and by the local dev/test migrate scripts, and a small module that
  reads the manifest and upserts it via the `PATTERNS_DB` binding.
- **Changed**: `migrations/patterns/0002_seed_patterns.sql` (rows
  removed / neutralised once the manifest is authoritative — a new
  migration, not an edit to the applied one), `scripts/deploy.mjs`,
  the `db:migrate:*` npm scripts, `content.config.ts` /
  `content/docs/2.strudel.md` and new `content/docs/` Strudel pages.
- **Data**: curated pattern rows in the remote `jaime-patterns` D1 are
  reconciled to the manifest on the next deploy; user-created rows
  (none yet) are out of the reconcile set.
- No API surface change — `/api/patterns*` and the `/app/patterns`
  page keep working against the same schema.
- No new runtime dependency expected (manifest parse + D1 upsert only).
