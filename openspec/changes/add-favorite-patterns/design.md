## Context

Two independent systems exist today for "load some Strudel code instead
of typing it": the pattern-library (D1-backed, manifest-driven, see
`openspec/specs/pattern-library/spec.md` and
`content/patterns/README.md`) and the Composition Room's unspecified
"starter" dropdown (`app/lib/compositionPresets.ts`, a hardcoded array
of raw-imported `.js` files). See `proposal.md` for why these are being
merged.

Relevant existing contract, confirmed by reading the code:
- `patterns` table (`migrations/patterns/0001_init.sql`): `id, title,
  code, source_url, source_author, created_at`, plus an `origin`
  column added in `0004_pattern_origin.sql` (`'curated'` | `'user'`).
  Reconcile (`scripts/lib/patterns-manifest.mjs` →
  `scripts/sync-patterns.mjs`) only ever touches `origin='curated'`
  rows — a `'user'` row is untouched by every future deploy.
- `server/catalog/patterns.ts` is the only place that reads
  `PATTERNS_DB`; `GET /api/patterns` (`server/api/patterns/index.get.ts`)
  already supports `tag`, `q`, `page`, `limit` query params.
- `app/pages/app/patterns.vue` shows the existing client pattern for
  fetching the catalog (`useFetch('/api/patterns', { query: {...} })`).
- `id` values are `nanoid` (already a dependency, used the same way in
  `server/auth/users.ts`, `app/pages/app/jam/index.vue`, etc.).

## Goals / Non-Goals

**Goals:**
- One content system for both short snippets and long-form starters.
- Composition Room's starter list becomes editable without a rebuild
  or deploy (add/remove/tweak by editing the manifest, or — via the
  new skill — by writing straight to the database).
- A pattern's code is always one click from the real strudel.cc REPL.

**Non-Goals:**
- Not building a full pattern-editing UI (no in-app "create/edit
  pattern" form) — the manifest and the new skill remain the two entry
  points for adding a pattern, same as today.
- Not changing JAM's "load into JAM" flow beyond adding the strudel.cc
  link where practical — no redesign of JAM.
- Not building tag/favorite management UI in the Pattern Library page
  itself — `favorite` is set at authoring time (manifest or skill),
  not toggled from the browser.

## Decisions

### 1. `favorite` is a column + a query filter, not a new endpoint
Add `favorite INTEGER NOT NULL DEFAULT 0` (SQLite/D1 boolean-as-integer,
matching existing style — no other boolean column exists yet, but this
is the standard D1/SQLite idiom) via
`migrations/patterns/0008_pattern_favorite.sql`. Extend `Pattern` /
`PatternRow` / `rowToPattern` with `favorite: boolean`, and
`ListPatternsQuery` / `buildFilter` with an optional `favorite: boolean`
that adds `AND p.favorite = 1` to the existing WHERE-clause builder.
`GET /api/patterns` accepts `?favorite=true`. Alternative considered:
a separate `/api/patterns/favorites` endpoint — rejected, it's the same
list shape with one more filter, not a different resource.

### 2. Composition Room's picker fetches once, filters client-side
The favorites list is a small, curated showcase (3 today, expected to
stay in the tens, not hundreds). The picker does one
`useFetch('/api/patterns', { query: { favorite: true, limit: 60 } })`
on mount and hands the result to Nuxt UI's `USelectMenu` with
`searchable` — filtering happens in the component against the already-
fetched list, no per-keystroke request. Alternative considered:
wire the search box to the existing server-side `q` param on every
keystroke — rejected for now as unnecessary latency for a list this
size; revisit if the favorites list grows enough to need pagination.
Replaces the current `UDropdownMenu` "Load a starter" button
(`app/pages/app/composition/[id].vue`); keep the
`data-testid="load-preset-button"` on the trigger so
`e2e/composition.spec.ts` / `e2e/mobile-rooms.spec.ts` need only their
menu-item interaction updated, not their entry point.

### 3. The three existing starters become plain manifest entries
`birds-of-a-feather.md`, `caverave.md`, `dinofunk.md` under
`content/patterns/`, `favorite: true`, tagged `starter` (a plain
free-form tag, not a schema concept) so they're identifiable in the
general Pattern Library grid too. Same ids as their current file
stems — no `seed-`-style prefix, `favorite`/`starter` tag already
disambiguates purpose. Code carried over byte-for-byte from
`app/lib/compositions/*.js`, including each one's `@title`/`@by`/
`@license` header comment, exactly like every other manifest entry's
code block does today.

### 4. "Open in strudel.cc" is a pure client-side link, not a proxy
strudel.cc's own showcase page encodes a pattern as
`https://strudel.cc/#<base64 of the UTF-8 source>` — confirmed this
session by `base64 -d`-decoding several of its example links directly.
A small helper (`app/lib/strudelShareLink.ts`,
`toStrudelUrl(code: string): string`) builds
`` `https://strudel.cc/#${btoa(unescape(encodeURIComponent(code)))}` ``
(the standard UTF-8-safe `btoa` idiom) and the UI renders it as a plain
`<a target="_blank">` — no server involvement, no new API. In scope:
the pattern-library page (wherever a pattern's code is shown/previewed)
and the Composition Room header (linking the room's *current* shared
document, not just a freshly-loaded starter — more useful, and trivial
since the code is already in hand). JAM's per-track view is a nice-to-
have left as an open task, not required for this change to be
complete.

### 5. The ingestion skill writes directly to `PATTERNS_DB`, no manifest file
This is the key architectural point from the user's clarification: the
skill is **not** another manifest-file author. It runs a small script
(`scripts/add-pattern.mjs <url> --title ... [--author ...] [--tags ...]
[--favorite] [--remote]`) that:
1. Resolves the input URL — either a `strudel.cc/#<base64>` REPL link
   (decode the fragment) or a raw source URL (fetch it directly).
2. Extracts `@title` / `@by` / `@license` from a leading comment block
   when present (same convention as every strudel.cc example), to
   suggest `--title`/`--author` if the caller didn't pass them.
3. Refuses to proceed without a resolvable `source_url` — same
   attribution rule the manifest enforces, no exception for this path.
4. Generates an id with `nanoid(10)` (matching the project's existing
   id convention) and writes one `INSERT INTO patterns (..., origin,
   favorite) VALUES (..., 'user', ?)` plus its tag rows, via
   `wrangler d1 execute PATTERNS_DB --local` by default (`--remote`
   only when explicitly passed — mirrors `sync-patterns.mjs`'s own
   `--remote` opt-in), reusing the same SQL-escaping helper style as
   `scripts/lib/patterns-manifest.mjs`.
Because the row is `origin='user'`, no future `npm run deploy` /
`sync-patterns.mjs` reconcile will ever touch or delete it — it simply
exists in the database going forward, exactly like a hand-written
manifest entry except it skipped the manifest.
The skill itself (`.claude/skills/add-pattern/SKILL.md`) is a thin
instruction layer: given a link (and optionally a role like "make this
a Composition Room starter"), gather the missing pieces conversationally
(title/author when the header doesn't have them, tags, whether to set
`favorite`), then invoke the script. This directly replaces the
manual research-and-decode workflow used earlier this session to add
Caverave/Dinofunk/etc.

## Risks / Trade-offs

- **Direct-to-DB writes bypass code review of content before it's
  live** → Mitigation: local-only by default; `--remote` is an
  explicit, separate flag the user must ask for, same convention
  `sync-patterns.mjs` already uses for exactly this reason.
- **`favorite` rows could clutter the general Pattern Library grid**
  with long-form entries mixed among short snippets → Mitigation: the
  `starter` tag makes them filterable/identifiable there too; no
  schema change needed if this needs tightening later (e.g. hiding
  long entries from the default grid) — deferred, not blocking.
- **Fetching all favorites unfiltered doesn't scale indefinitely** →
  Mitigation: acceptable at today's and near-term scale (a curated
  showcase, not a general catalog); revisit with server-side search
  if/when it grows past ~50 entries.
- **Existing e2e tests hardcode the old dropdown's interaction** →
  Mitigation: tasks update `e2e/composition.spec.ts` and
  `e2e/mobile-rooms.spec.ts` for `USelectMenu`'s interaction pattern,
  keeping the same `data-testid` entry point.

## Migration Plan

1. Add migration `0008_pattern_favorite.sql`; extend
   `patterns-manifest.mjs` (parse `favorite` frontmatter, default
   `false`) and its generated SQL; extend `shared/catalog.ts`,
   `server/catalog/patterns.ts`, `server/api/patterns/index.get.ts`.
2. Write the three `content/patterns/*.md` entries (`favorite: true`,
   tag `starter`), byte-for-byte from the current `.js` files.
3. Run `npm run patterns:sync` locally; verify the three rows land
   with `favorite=1` and the app's Pattern Library page shows them.
4. Add `app/lib/strudelShareLink.ts`; add the "open in strudel.cc"
   link to the pattern-library UI and the Composition Room header.
5. Replace the Composition Room's dropdown with the `USelectMenu`
   sourced from `/api/patterns?favorite=true`; update the two e2e
   specs.
6. Delete `app/lib/compositionPresets.ts` and
   `app/lib/compositions/*.js`.
7. Add `scripts/add-pattern.mjs` and
   `.claude/skills/add-pattern/SKILL.md`.
8. Update `content/patterns/README.md` to document `favorite`.
9. `npm run deploy` (build → migrate `PATTERNS_DB` remote → sync
   patterns remote → wrangler deploy) — same deploy path as always,
   no new step; this change adds a column and content, not a new
   deploy mechanism.

Rollback: the migration is additive-only (new defaulted column) — no
destructive rollback path is needed; a problem found after deploy gets
fixed forward. The `compositionPresets.ts` deletion is trivially
revertible from git history before that step ships if needed.
