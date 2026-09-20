## Why

jaime is now a chat hangout for developers, with the Composition Room
as its main product and `@jah` — the red lion — as its face. The
homepage still pitches "a hub of small music tools" with JAM as the
primary call to action, so the first thing a visitor reads is the old
product.

## What Changes

- **New pitch.** The hero carries the tagline "Your dev hangout —
  live-code, chat, and let @jah keep watch." with a short description
  of jaime as a place for developers to hang out and chat. The page
  title, meta description, landing footer, and the docs home intro
  drop the "hub of small music tools" wording.
- **`@jah` is the headline.** A prominent "Meet @jah" section, right
  after the hero, shows the red lion (the existing avatar), what it
  does, and how to talk to it (`@jah <question>` in the room's chat).
  It states plainly that `@jah` is invite-only for now.
- **The Composition Room is the way in.** The one primary call to
  action becomes "Start a room" — it creates a room and goes straight
  in (the Chat tab is already the default). "Try JAM" is gone from the
  hero and the bottom CTA.
- **JAM is demoted, not removed.** It leaves the hero, the tools grid,
  and the dashboard sidebar's main group. It stays reachable from a
  low-key link in the landing footer and a small secondary entry at the
  bottom of the dashboard sidebar. `/app/jam` and its rooms keep
  working exactly as today.
- **Features section with game-icons.** The old "What's in the hub"
  tools grid becomes a features section — chat, live Strudel coding,
  the ASCII art panel, the pattern library — each card carrying a
  game-icons.net icon. Icons are used more liberally across the page
  (section headings, notices), and each is added to
  `GAME_ICONS_IN_USE` and credited per icon.
- **Starter patterns, one click into a room.** A "Start from a
  pattern" section lists the starter patterns (the favorited ones that
  already seed the Composition Room's starter picker); each opens a
  fresh Composition Room seeded with that pattern, via the existing
  `?load=<patternId>` mechanism. No sign-in in the way.
- **Games notice.** A small "Games — coming soon" notice with the
  console-controller icon. No link, no destination.
- **Welcome-back shortcut** now points at the Composition Room instead
  of JAM.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities
- `landing-page`: the value proposition becomes the developer-hangout
  tagline; "Tools Are Listed In Order" is replaced by a features
  section; the primary call to action becomes starting a Composition
  Room; hero secondary links no longer include JAM; the returning-visitor
  fast path targets the Composition Room. New requirements: `@jah` is
  the headline section, starter patterns open in a Composition Room,
  JAM is reachable only from low-key links, a games-coming-soon notice,
  and game-icons on the page are attributed per icon.
- `dashboard-shell`: "Sidebar Lists Home And Tools In Order" changes —
  Composition Room and Patterns are the main entries, and JAM moves to
  a separate, less prominent entry below them. "JAM Is Served From The
  Dashboard" is unchanged.

## Impact

- **UI**: `app/pages/index.vue` (rewritten), `app/layouts/landing.vue`
  (nav labels, footer wording, JAM footer link), `app/layouts/dashboard.vue`
  and `app/layouts/docs.vue` (JAM moves out of the main tool list),
  `app/utils/tools.ts` (Composition Room only in the main list; JAM in a
  separate demoted list).
- **Icons**: `nuxt.config.ts` `GAME_ICONS_IN_USE` gains the icons the
  page uses; `content/credits/game-icons.md` gains a row per icon
  (author verified against the `game-icons/icons` repo); the homepage
  shows the credit inline.
- **Content**: `content/docs/1.index.md` intro line.
- **Tests**: e2e specs that click "Composition Room" or rely on the old
  hero/tools-grid labels (`e2e/docs.spec.ts`, `e2e/articles.spec.ts`
  home checks) updated; a new e2e covers the starter-pattern link.
- **No API, schema, or server changes.** Starter patterns come from the
  existing `GET /api/patterns?favorite=true`; loading uses the existing
  `?load=` path.
- **Out of scope**: no `@jah` system-prompt or persona change (the
  lion stays as the avatar, "always respectful" is a docs note only); no
  games link or games code; no new roadmap; docs 02/03 untouched.
