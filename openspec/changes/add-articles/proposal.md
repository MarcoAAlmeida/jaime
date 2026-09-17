## Why

jaime's docs are currently almost entirely
[Diátaxis](https://diataxis.fr) **Reference** (terse API-style lookup
for Strudel's mini-notation/sounds/effects), with one thin, gated
sliver of **Explanation** ("Behind the scenes"). That shape reads as
superficial — reference material only satisfies someone who already
knows what they're looking up; there's nothing that explores an idea,
gives context, or connects jaime's choices to the wider landscape they
draw from. This change adds a second, parallel content type —
**Articles** — for exactly that: long-form, screenshot-rich,
Explanation-type pieces, reachable from both the home page and a full
index, deliberately *not* organized into Docs' nav-tree hierarchy.

This is the structural/routing half only. The four articles' actual
prose is scoped and briefed here (so the plan survives independent of
any one conversation), but writing them is editorial work that happens
once the plumbing exists — not spec-gated.

## What Changes

- **A new `articles` content collection** (`content/articles/*.md`),
  parallel to the existing `docs` collection but without a nav tree —
  flat, one page per article, optionally tagged for loose future
  grouping.
- **Two discovery paths**, both required: a "Articles" section on the
  home page (teaser cards, same `UPageGrid`/`UPageCard` pattern as the
  existing "Tools" section) and a full `/articles` index listing every
  article. Both link into the same `/articles/<slug>` pages.
- **Auth-gating carries over** from docs-shell: an article can require
  sign-in (locked indicator in both listings, signed-out visitors get
  an explainer instead of the content) — the same UX contract
  `docs-shell` already has, reused rather than reinvented.
- **Strudel's docs content is retired from Reference, not deleted from
  the product**: `mini-notation.md`, `sounds.md`, `effects.md`, and
  `in-jam.md` are removed outright (their material duplicates
  strudel.cc's own canonical reference). `strudel.md` itself moves to
  Articles, rewritten as a richer Explanation piece. `behind-the-scenes.md`
  also moves to Articles (enhanced), keeping its existing auth gate.
- **Docs gains one new Reference page**: `ascii-art.md`, covering the
  scraped-gallery data source behind the Composition Room's ASCII
  panel. Docs stays a first-class top-level section — it's just thin
  for now, expected to grow with time.
- **Two more articles, both new**: `animation-libraries.md` (the
  GSAP-alternatives survey researched in this project, with a
  screenshot per library) and `diataxis.md` (why jaime's docs are
  organized around Reference vs. Explanation at all).

Explicitly not in this change: a Tutorial-type third content pillar
(identified as the other real gap, but no pages committed to it yet);
a tag-filtering UI (tags are captured in frontmatter now so a future
pass doesn't need a schema migration, but browsing by tag is not
built); the actual prose of the four articles beyond the briefs in
`tasks.md`.

## Capabilities

### New Capabilities

- `articles`: the Explanation-type content collection, its two
  discovery surfaces (home teaser + full index), the no-nav-tree
  per-article page, and the reused auth-gating contract.

### Modified Capabilities

- `landing-page`: gains a requirement that the home page surfaces
  article teasers.
- `docs-shell`: its "nav tree lists a topic per section" requirement is
  updated to stop naming Strudel as the example (Strudel is leaving
  Docs) — the nav-tree mechanism itself, the auth-required support, and
  the quick-links-to-tools requirement are all unchanged.

## Impact

- **New**: `content/articles/*.md` (4 files), a new `articles`
  collection in `content.config.ts`, `app/pages/articles/index.vue`,
  `app/pages/articles/[...slug].vue`, a new landing-page section in
  `app/pages/index.vue`.
- **Removed**: `content/docs/2.strudel/1.mini-notation.md`,
  `2.sounds.md`, `3.effects.md`, `4.in-jam.md` (and the now-empty
  `2.strudel/` directory).
- **Moved**: `content/docs/2.strudel.md` →
  `content/articles/strudel.md` (rewritten); `content/docs/9.behind-the-scenes.md`
  → `content/articles/behind-the-scenes.md` (enhanced, gate kept).
- **Modified**: `content/docs/1.index.md` (no longer name-checks
  Strudel as the flagship section).
- **New Docs content**: `content/docs/ascii-art.md`.
- No change to JAM, Composition Room, the pattern library, or auth
  itself (reuses the existing session/sign-in flow).
