## Context

`content.config.ts` currently defines one `page`-type collection,
`docs` (source `docs/**/*.md`), with an `authRequired` boolean schema
field. `app/pages/docs/[...slug].vue` reads that field and, for a
signed-out visitor, strips the body (`{ type: 'minimal', value: [] }`)
before it ever reaches the response — the lock is enforced server-side,
not hidden with CSS. `app/pages/docs/index.vue` renders the docs home
page as a single `UPage` (header + rendered markdown body), no card
grid. `app/pages/index.vue` (the real site root) already has a
`UPageGrid`/`UPageCard` section for Tools, styled and structured
exactly like what an Articles teaser section needs.

Diátaxis analysis of the current docs (done in conversation, not
repeated here): every existing Strudel sub-page is Reference; only
`behind-the-scenes.md` is Explanation, and it's thin and gated. See
`proposal.md` for the "Why."

## Goals / Non-Goals

**Goals:**
- Stand up Articles as a real, separate content type with its own
  collection, routes, and two discovery surfaces.
- Reuse the docs-shell's exact auth-gating contract rather than
  inventing a second locking mechanism.
- Leave room for tags without committing to a tag-browsing UI now.

**Non-Goals:**
- A Tutorial-type third pillar — identified, not built.
- Tag filtering/browsing UI — tags are frontmatter metadata only in
  this change.
- Any change to how sign-in itself works.
- Automatic content migration tooling — the file moves/rewrites in
  this change are done by hand once (four files), not worth scripting.

## Decisions

**A separate `articles` collection, not a flag on `docs`.** Articles
need fields Docs doesn't (a cover image, optional tags) and explicitly
must not carry a nav tree, while Docs' nav-tree behavior is core to
that collection's own spec. Modeling them as one collection with a
"type" discriminator would tangle two different rendering contracts
(tree vs. flat) into one route. Two collections, two route trees
(`/docs/**` and `/articles/**`), same underlying `page` content type.

**Auth-gating logic is duplicated, not abstracted.** The lock check
(`if (authRequired && !user) strip body`) is ~5 lines, used in exactly
two places. A shared composable for two call sites is the premature
abstraction this project generally avoids — `app/pages/articles/[...slug].vue`
repeats the pattern from `app/pages/docs/[...slug].vue` verbatim rather
than factoring out a helper neither side is likely to diverge from
independently, but also isn't obviously the same concern long-term.

**Layout: reuse `landing`, not `docs`.** The `docs` layout
(`app/layouts/docs.vue`) renders `UDashboardPanel` + a sidebar nav
tree — exactly the chrome Articles is deliberately not supposed to
have per the "no nav tree" decision. `landing` (already used by
`app/pages/index.vue`) is public, chrome-light, and already hosts a
`UPageGrid`/`UPageCard` section — the right register for a page meant
to read as content, not tool.

**Ordering: `publishedAt`, not filename numbering.** Docs pages use a
`N.name.md` filename prefix to fix nav-tree order. Articles have no
tree to order, but the home teaser and the full index still need a
stable, meaningful sort — a `publishedAt` date field (schema-required)
sorted descending (newest first) is more meaningful than alphabetical
and doesn't require renaming a file to reorder it later.

**Tags are a schema field now, unused by any UI yet.** `tags:
z.array(z.string()).optional()` costs nothing to add today and avoids
a schema migration the first time someone wants to filter by tag —
consistent with "don't design for hypothetical requirements" only
where the hypothetical would otherwise force a breaking change later;
an optional array field is not that.

**`content/docs/1.index.md` gets a small edit, not a rewrite.** It
currently says the docs "collect notes... starting with Strudel." Once
Strudel leaves, that sentence is simply false. Swap the name-check to
ASCII Art; the rest of the page's framing ("jaime is a hub of small
tools... these pages collect references for the tools' underlying
languages") still holds.

## Risks / Trade-offs

- **Two near-identical `[...slug].vue` route files** (Docs' and
  Articles') is real duplication → accepted per the abstraction
  decision above; revisit only if a third collection needs the same
  gating contract.
- **Removing `mini-notation.md`/`sounds.md`/`effects.md`/`in-jam.md`
  loses any inbound links** to those specific pages (the pattern
  library's Strudel doc cross-references, if any, and the "Strudel in
  jaime" page's own internal links to `/docs/strudel/mini-notation`
  etc.) → grep the codebase for links to these paths as an explicit
  task before deleting, and fix or drop each one found.
- **`behind-the-scenes.md` moving collections** changes its URL from
  `/docs/behind-the-scenes` to `/articles/behind-the-scenes` → check
  for any existing inbound link (e.g. from account/settings pages) and
  update it in the same change.

## Migration Plan

1. Add the `articles` collection to `content.config.ts`; build the two
   new routes and the home-page section against empty content first
   (verifiable with one throwaway test article) — proves the plumbing
   before any real prose is written or any old page is deleted.
2. Write and move the four real articles (briefed in `tasks.md`).
3. Only once real Articles content exists: delete the four retired
   Strudel Reference sub-pages and update `content/docs/1.index.md`
   and the docs-shell nav.
4. No feature flag / rollback plan beyond normal git revert — this is
   additive content-collection work with no runtime state migration.
