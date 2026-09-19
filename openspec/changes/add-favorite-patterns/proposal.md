## Why

Composition Room "starters" and Pattern Library "patterns" are the same
idea — a piece of attributed Strudel code you load instead of typing
from scratch — implemented twice. Starters live as a hardcoded
TypeScript array (`app/lib/compositionPresets.ts`) importing raw `.js`
files, entirely outside the pattern-library's manifest/D1 system and
outside any spec. That duplication already cost real friction this
session: adding four starters and then removing two each required a
code change, a full `nuxt build`, and a `wrangler deploy` — the exact
cost the pattern-library's D1-backed catalog was built to avoid.
Starters are just patterns, only longer; they should be one system.

## What Changes

- Add a `favorite` boolean to the Pattern shape (manifest frontmatter
  field + a new `PATTERNS_DB` column via migration). A pattern with
  `favorite: true` is eligible to appear in the Composition Room's
  starter picker; all other pattern-library behavior is unaffected.
- Migrate the three existing composition starters (Birds of a Feather,
  Caverave, Dinofunk) into `content/patterns/*.md` entries with
  `favorite: true`, carrying their existing attribution forward
  unchanged. **BREAKING**: delete `app/lib/compositionPresets.ts` and
  `app/lib/compositions/*.js` — the manifest becomes the only source of
  starters, so a starter can no longer be added or removed without
  touching the pattern-library.
- Replace the Composition Room's "Load a starter" dropdown menu with a
  searchable select, sourced from the Pattern API filtered to
  `favorite = true`, instead of the bundled array. Selecting one keeps
  today's behavior: replace the whole shared document (stopping
  playback first, per the fix shipped earlier this session).
- Add an "open in strudel.cc" action to the pattern-library, available
  wherever a pattern's code is shown or loaded (library preview,
  Composition Room's loaded starter, JAM's loaded track), linking to
  `https://strudel.cc/#<base64 of the code>`.
- Add a new project skill that ingests a pattern from an external link
  (a strudel.cc REPL link or a raw source URL) directly into
  `PATTERNS_DB`, writing it as a non-curated (`origin = 'user'`) row so
  it follows the pattern contract (title, code, tags, source
  attribution, `favorite`) without being owned by — or wiped by — the
  version-controlled manifest's deploy-time reconcile.

## Capabilities

### New Capabilities

(none — this folds an unspecified, ad hoc system into two existing
capabilities rather than introducing a new one)

### Modified Capabilities
- `pattern-library`: adds the `favorite` field to the Pattern shape and
  its manifest/migration handling; adds the "open in strudel.cc"
  action as a new requirement; documents that a pattern may be created
  directly in the database as a non-curated row (already implied by
  the existing "reconciling does not touch non-curated patterns"
  requirement, now with a concrete producer of such rows).
- `composition-room`: replaces the unspecified "starter" dropdown with
  a specified requirement — a searchable picker over favorited
  patterns, sourced from the pattern-library instead of bundled code.

## Impact

- **Schema**: new `migrations/patterns/000X_add_favorite.sql` adding a
  `favorite` column (default false) to the patterns table.
- **Content**: `content/patterns/*.md` gains a `favorite` frontmatter
  field (optional, default false) and three new/migrated long-form
  entries; `content/patterns/README.md` documents the field.
- **Sync**: `scripts/sync-patterns.mjs` reads and reconciles the new
  field.
- **Removed**: `app/lib/compositionPresets.ts`,
  `app/lib/compositions/*.js`.
- **UI**: `app/pages/app/composition/[id].vue`'s starter control
  becomes a searchable select backed by a Pattern API call filtered to
  favorites; a new "open in strudel.cc" control appears there and in
  the pattern-library UI.
- **API**: the existing Pattern read API needs a `favorite` filter (or
  the client filters a full favorites-only fetch — decided in design).
- **New tooling**: a project skill (`.claude/skills/...`) that writes
  directly to `PATTERNS_DB` (local and remote) as a user-authored
  pattern; no manifest file, no deploy required to take effect.
