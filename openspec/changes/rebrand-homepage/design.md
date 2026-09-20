## Context

See proposal.md — Why. The pieces this touches:

- `app/pages/index.vue` renders the landing page on `UPageHero` /
  `UPageSection` / `UPageCard` / `UPageCTA`, inside the `landing` layout
  (`UHeader` nav + `UFooter`). It lists `TOOLS` from `app/utils/tools.ts`
  in a grid.
- `TOOLS` (Composition Room, JAM) is the single source for the landing
  grid, the dashboard sidebar (`app/layouts/dashboard.vue`) and the docs
  sidebar quick links (`app/layouts/docs.vue`). The `docs-shell` spec
  requires quick links to every tool, JAM included, so JAM must stay in
  the docs sidebar.
- game-icons.net icons render through Nuxt UI's `UIcon` from a local
  subset: an icon works only if its bare name is in `GAME_ICONS_IN_USE`
  (`nuxt.config.ts`), and CC BY 3.0 needs a per-icon row in
  `content/credits/game-icons.md` plus a credit shown where the icon is
  used (`icon-library` spec). `lion` is already credited (Lorc), used as
  a static SVG (`public/jah-avatar.svg`), not through `UIcon`.
- The starter patterns are the favorited catalog rows — today
  `caverave`, `dinofunk`, `birds-of-a-feather` — readable through
  `GET /api/patterns?favorite=true`. "Load into Composition Room" is
  `navigateTo('/app/composition/<nanoid>?load=<patternId>')` on the
  patterns page; the room page seeds itself from `?load=`, falling back
  to the generic starter document on a bad id.
- `@jah` replies only for a signed-in, allowlisted account (anyone else
  gets an invite-only reply), so the page must not promise open access.

## Goals / Non-Goals

**Goals:**
- One rewrite of the landing page, with no new pages, routes, APIs or
  server code.
- JAM demoted through one shared structure, so the landing footer,
  dashboard sidebar and docs sidebar cannot drift apart.

**Non-Goals:**
- No `@jah` prompt or persona change; no new lion artwork.
- No games link, games code, or shared login work.
- No redesign of the dashboard, docs or room pages beyond moving JAM.

## Decisions

### 1. "Start a room" is a button that creates the room, not a link to the create/join screen

The primary action generates a room id and navigates straight to
`/app/composition/<id>`, the same as the create button on
`/app/composition`. Chat is already the room's default tab, so the
visitor lands in the conversation. Alternative considered: link to
`/app/composition` (the create/join screen) — one more click for
the common case, and it keeps the old JAM-style "landing then create
screen" double step.

### 2. `@jah`'s section reuses the existing avatar

The lion is `/jah-avatar.svg` shown at hero size (an `<img>`, alt
"@jah"), not a `UIcon`, so it needs no `GAME_ICONS_IN_USE` entry and
its credit already exists. The section shows a small sample exchange
(`@jah how does .fast work?` and a short answer) as static markup to
show the shape of a conversation — not a live call and not a model
output presented as real. Alternative considered: a live "try it" box
on the page — it would spend model credits for anonymous visitors and
`@jah` is invite-only.

### 3. The access line is a static "Invite-only for now"

The page cannot know a visitor's access, and a per-visitor "you're on
the list" state is scope beyond a homepage. The copy states the current
truth and links sign-in. Alternative: hide access details — misleading,
since a visitor would find out from the first reply.

### 4. Game icons: nine, each verified and credited

Chosen from the local set, each verified to exist there, with its
author confirmed against the `game-icons/icons` repository layout
(author directory + file):

| Icon | Author | Where it appears |
| ---- | ------ | ---------------- |
| `lion` | Lorc | already credited; the `@jah` section heading badge |
| `chat-bubble` | Delapouite | chat feature card |
| `musical-notes` | Delapouite | live Strudel coding card |
| `rune-stone` | Lorc | ASCII art panel card |
| `scroll-unfurled` | Lorc | pattern library card |
| `laptop` | Delapouite | "Start from a pattern" section heading |
| `campfire` | Lorc | hero accent / "hangout" |
| `sound-waves` | Skoll | ASCII-panel-synced-to-music accent |
| `console-controller` | Skoll | games coming-soon notice |

The credit line at the foot of the page names each author and links
game-icons.net. It is generated from one list next to the page's icon
names (icon → author), so adding an icon without an author is a type
error rather than a silent omission. The same rows go in
`content/credits/game-icons.md`. Alternative: a single blanket credit
— rejected by the `icon-library` spec (per-icon attribution).

### 5. Starter patterns come from the existing API, fetched at render, and fail soft

The section uses `GET /api/patterns?favorite=true` through
`useAsyncData`. On any error or an empty list the section is not
rendered — the landing page must never show an error for a secondary
section. Each card shows the pattern's title and description with an
"Open in Composition Room" button that navigates to a fresh room with
`?load=<id>`. Alternatives: a hardcoded list of ids (drifts from the
catalog; breaks if a pattern is unfavorited) or content collection
queries (patterns live in D1 at runtime).

### 6. JAM is demoted by splitting the tool list, not by deleting it

`app/utils/tools.ts` exports `TOOLS` (Composition Room) and a new
`DEMOTED_TOOLS` (JAM). The landing footer shows JAM as a small ghost
link from `DEMOTED_TOOLS`; the dashboard sidebar renders it in a second
group below the main entries; the docs sidebar appends it after
Patterns (keeping the `docs-shell` quick-link requirement true).
`/app/jam` and its rooms are untouched. Alternative: keep one list with
an `emphasis` flag — more branching in three consumers for the same
result.

### 7. The games notice is a plain, non-interactive alert

A `UAlert` (neutral, subtle) with the `console-controller` icon and the
text "Games — coming soon". No `to`, no actions, no link. It sits
between the starter-patterns section and the articles.

### 8. Page structure

Hero → `@jah` → features → starter patterns → games notice → articles
(kept, retitled "Ideas behind jaime") → closing CTA ("Stay in the loop":
community signup + "Start a room") → icon credit line. Header nav
labels: Features, Docs, Articles, Community; the "Tools" anchor becomes
`#features`. The landing footer text becomes "jaime — a hangout for
developers." with the JAM link beside the existing Strudel link.

## Risks / Trade-offs

- [Visitors expect `@jah` to answer immediately] → the section says
  "invite-only for now" and the sample is labelled as an example.
- [A favorited pattern that fails in a room] → the existing `?load=`
  fallback opens the generic starter document instead of an empty room;
  the e2e opens each listed starter once.
- [Nine more icons grow the Worker] → the subset is nine small SVG
  bodies; the design note in `nuxt.config.ts` measured the full set at
  +6 MB, which is why only a subset ships.
- [Copy drift] → the tagline lives once in `index.vue` and is asserted
  by the e2e; the landing spec quotes it verbatim.
- [Existing e2e specs break on removed labels] → they are updated in
  the same change (see tasks).

## Migration Plan

Front-end only: ship with the normal deploy. Rollback is reverting the
commit. No data or configuration changes; `/app/jam` links and rooms
keep working throughout.
