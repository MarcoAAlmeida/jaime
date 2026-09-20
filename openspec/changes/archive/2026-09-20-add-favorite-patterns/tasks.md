## 1. Schema and catalog read model

- [x] 1.1 Add `migrations/patterns/0008_pattern_favorite.sql`:
      `ALTER TABLE patterns ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;`
- [x] 1.2 Extend `shared/catalog.ts`'s `Pattern` with `favorite: boolean`
- [x] 1.3 Extend `server/catalog/patterns.ts`: `PatternRow`, `rowToPattern`,
      `ListPatternsQuery`/`buildFilter` (favorite filter), `listPatterns`
      SELECTs, `getPattern` SELECT
- [x] 1.4 Extend `server/api/patterns/index.get.ts` to parse `?favorite=true`
      and pass it through

## 2. Manifest support for `favorite`

- [x] 2.1 Extend `scripts/lib/patterns-manifest.mjs`: parse optional
      `favorite` frontmatter (boolean, default `false`) into
      `PatternEntry`
- [x] 2.2 Extend `toReconcileSql` to include `favorite` in the INSERT /
      ON CONFLICT UPDATE
      (also extended `patterns-manifest.test.mjs` — 21/21 passing)
- [x] 2.3 Update `content/patterns/README.md` to document the `favorite`
      field

## 3. Migrate the three existing starters into the manifest

- [x] 3.1 Write `content/patterns/birds-of-a-feather.md` (frontmatter:
      title, source_url, source_author, tags incl. `starter`,
      `favorite: true`; body: verbatim code from
      `app/lib/compositions/birds-of-a-feather.js`)
- [x] 3.2 Write `content/patterns/caverave.md` (same shape, from
      `app/lib/compositions/caverave.js`)
- [x] 3.3 Write `content/patterns/dinofunk.md` (same shape, from
      `app/lib/compositions/dinofunk.js`)
- [x] 3.4 Run `npm run patterns:sync` locally; verify all three rows
      exist with `favorite=1` via `npx wrangler d1 execute PATTERNS_DB
      --local --command "SELECT id, favorite FROM patterns"`
      (required `wrangler d1 migrations apply PATTERNS_DB --local`
      first — confirmed all three rows landed with favorite=1)
- [x] 3.5 Confirm the three now show up in `/app/patterns` (general
      Pattern Library page), tagged `starter`
      (verified in browser: "starter" tag filter shows exactly
      Dinofunk, Caverave, Birds of a Feather (remake))

## 4. "Open in strudel.cc"

- [x] 4.1 Add `app/lib/strudelShareLink.ts` exporting
      `toStrudelUrl(code: string): string`
- [x] 4.2 Add the link/button to the pattern-library UI
      (`app/pages/app/patterns.vue`, wherever a pattern's code is
      shown/previewed)
- [x] 4.3 Add the link/button to the Composition Room header
      (`app/pages/app/composition/[id].vue`), pointing at the room's
      current shared document content (not just a freshly-loaded
      starter)

## 5. Composition Room: searchable pattern picker

- [x] 5.1 In `app/pages/app/composition/[id].vue`, replace the
      `COMPOSITION_PRESETS`-backed `UDropdownMenu` with a `USelectMenu`
      (searchable by default) fetching `/api/patterns?favorite=true&limit=60`
      once on mount
- [x] 5.2 Keep `data-testid="load-preset-button"` on the trigger;
      `loadPreset(code)` keeps its existing stop-playback-first
      behavior (already shipped) unchanged
- [x] 5.3 Show each option's title and source credit (mirroring
      today's `title` / `credit` display)
- [x] 5.4 Update `e2e/composition.spec.ts` (the "loads a starter
      composition" test) for the `USelectMenu` interaction
      (menuitem role → option role; to be confirmed against the real
      rendered DOM in the browser-verification pass)
- [x] 5.5 Update `e2e/mobile-rooms.spec.ts`'s reference to the same
      control if its interaction changed
      (no change needed — it only asserts visibility, doesn't open/
      select; its menuitem assertions are for the unrelated overflow
      menu, still a UDropdownMenu)

## 6. Remove the old starter system

- [x] 6.1 Delete `app/lib/compositionPresets.ts`
- [x] 6.2 Delete `app/lib/compositions/*.js`
- [x] 6.3 Grep the repo for any remaining reference to
      `compositionPresets` / `COMPOSITION_PRESETS` and remove it
      (only historical mentions remain, in this change's own
      proposal/design/tasks docs)

## 7. External-link ingestion skill

> **Won't do in this change (2026-09-20).** Superseded: the ingestion
> skill is being redesigned and will be specified as its own change. Two
> assumptions in design decision 5 no longer hold: the manifest
> (`content/patterns/*.md`, reconciled into the database on every deploy,
> now via CI) is the single source of truth, so the skill will write
> repo files rather than `origin='user'` database rows; and "resolve a
> link" turned out to be a pipeline (several link shapes, some carrying
> no code in the URL), not a base64 decode. Left unchecked, on purpose.

- [-] 7.1 (won't do) Add `scripts/add-pattern.mjs`: resolve a `strudel.cc/#<base64>`
      link (decode fragment) or a raw source URL (fetch directly);
      extract `@title`/`@by`/`@license` from a leading comment block
      when present; require a resolvable source URL or refuse; generate
      `nanoid(10)`; build and run the INSERT (`origin='user'`) plus tag
      rows via `wrangler d1 execute PATTERNS_DB` (`--local` by default,
      `--remote` only when explicitly passed), reusing
      `scripts/lib/patterns-manifest.mjs`'s SQL-escaping approach
- [-] 7.2 (won't do) Add CLI flags: `--title`, `--author`, `--tags`, `--favorite`,
      `--remote`
- [-] 7.3 (won't do) Add `.claude/skills/add-pattern/SKILL.md`: given a link (and
      optionally "make this a starter"), gather missing title/author/
      tags/favorite conversationally, then invoke the script
- [-] 7.4 (won't do) Verify end-to-end against local `PATTERNS_DB` with one real
      external link (e.g. re-add a dropped strudel.cc example) and
      confirm it survives `npm run patterns:sync` unchanged (origin
      untouched by reconcile)

## 8. Deploy

- [x] 8.1 Typecheck (`vue-tsc --noEmit`) and run the e2e suite
      (clean typecheck; 22/22 composition/mobile-rooms/ascii-panel e2e
      pass; pattern-playback.spec.ts's full-catalog preview also
      passes after two real fixes this pass surfaced: a pre-existing
      `\b`-boundary regex bug in that test for parenthetical titles,
      and a genuine gap where the Pattern Library's standalone preview
      engine never registered @strudel/codemirror's visual-widget
      methods — fixed in app/lib/prebake.ts, guarded so Composition
      Room/JAM's real widget wiring is never overwritten)
- [x] 8.2 `npm run deploy` (build → migrate `PATTERNS_DB` remote →
      sync patterns remote → wrangler deploy)
- [x] 8.3 Verify in production (2026-09-20, jaime.stream: the picker lists
      Dinofunk, Caverave and Birds of a Feather; Open in strudel.cc is
      present in the room; the e2e covers stop-before-load): Composition Room's picker shows the
      three favorited patterns searchable, loading one stops playback
      first, and "open in strudel.cc" works from both the Pattern
      Library and the Composition Room
