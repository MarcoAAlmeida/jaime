## 1. Tool lists and JAM demotion

- [ ] 1.1 `app/utils/tools.ts` — `TOOLS` becomes Composition Room only;
      add `DEMOTED_TOOLS` with JAM (same `Tool` shape, comment why it is
      separate).
- [ ] 1.2 `app/layouts/dashboard.vue` — main group: Home, Composition
      Room (from `TOOLS`), Patterns; a second group below it with the
      `DEMOTED_TOOLS` entries (JAM), above/beside Community, visually
      lower emphasis.
- [ ] 1.3 `app/layouts/docs.vue` — quick links: `TOOLS`, Patterns, then
      `DEMOTED_TOOLS` (JAM stays present, per the `docs-shell` spec).
- [ ] 1.4 `app/layouts/landing.vue` — nav labels Features / Docs /
      Articles / Community (`/#features`); footer text "jaime — a
      hangout for developers."; a low-key ghost "JAM" link from
      `DEMOTED_TOOLS` beside the Strudel link.

## 2. Game icons

- [ ] 2.1 `nuxt.config.ts` — fill `GAME_ICONS_IN_USE` with `lion`,
      `chat-bubble`, `musical-notes`, `rune-stone`, `scroll-unfurled`,
      `laptop`, `campfire`, `sound-waves`, `console-controller`.
- [ ] 2.2 `content/credits/game-icons.md` — add a row per new icon with
      its author and game-icons.net URL (Delapouite: chat-bubble,
      musical-notes, laptop; Lorc: rune-stone, scroll-unfurled,
      campfire; Skoll: sound-waves, console-controller); `lion` is
      already there — note it is now also rendered through `UIcon`.
- [ ] 2.3 Confirm each icon renders in the built page's server HTML
      (not just the client) — the subset must reach the Worker bundle.

## 3. Landing page

- [ ] 3.1 `app/pages/index.vue` — `useSeoMeta` title/description for
      the new positioning; hero with the tagline "Your dev hangout —
      live-code, chat, and let @jah keep watch.", the short
      description, the single primary "Start a room" button (creates a
      room id, navigates to `/app/composition/<id>`), a secondary
      "Pattern library" link, and the "Read the docs" link; no JAM.
- [ ] 3.2 Welcome-back alert (returning visitor) links to
      `/app/composition`.
- [ ] 3.3 "Meet @jah" section right after the hero: red lion
      (`/jah-avatar.svg`), heading with the `lion` icon, what `@jah` is,
      the `@jah <question>` form, a labelled static example exchange,
      the "invite-only for now" line, and an action that starts a room.
- [ ] 3.4 Features section (`id="features"`) with four cards — chat
      with `@jah`, live Strudel coding, the ASCII art panel, the
      pattern library — each with its game-icons icon; cards link to a
      new room or `/app/patterns` as appropriate.
- [ ] 3.5 "Start from a pattern" section: fetch
      `GET /api/patterns?favorite=true` via `useAsyncData`; a card per
      pattern (title, description) with an "Open in Composition Room"
      button that navigates to `/app/composition/<nanoid>?load=<id>`;
      omit the whole section on error or empty.
- [ ] 3.6 Games coming-soon notice: non-interactive `UAlert` with the
      `console-controller` icon, text "Games — coming soon", no link.
- [ ] 3.7 Keep the Articles section (retitled "Ideas behind jaime");
      closing CTA becomes "Stay in the loop" with "Join the community"
      and "Start a room" (no JAM link).
- [ ] 3.8 Icon credit line at the foot of the page: names each icon's
      author, links game-icons.net; built from one icon → author list
      shared with the template so it cannot omit an icon.

## 4. Docs copy

- [ ] 4.1 `content/docs/1.index.md` — replace the "hub of small,
      music-oriented tools" intro with the developer-hangout
      description.
- [ ] 4.2 `openspec/specs/landing-page/spec.md` and
      `openspec/specs/dashboard-shell/spec.md` Purpose sections —
      reword away from "hub of tools" (edit the main specs directly;
      a delta's Purpose is ignored).

## 5. Tests

- [ ] 5.1 Update `e2e/docs.spec.ts` (Composition Room link click) and
      the home-page checks in `e2e/articles.spec.ts` for the removed
      labels and the new structure.
- [ ] 5.2 New `e2e/landing.spec.ts`: tagline visible above the fold;
      exactly one primary action, "Start a room", lands in a
      Composition Room on the Chat tab; the `@jah` section shows the
      lion and "invite-only for now"; no JAM link in the hero/features
      but a JAM link in the footer; the games notice is present and is
      not a link; each starter-pattern button opens a room whose editor
      contains that pattern's code; the icon credit line names every
      author.
- [ ] 5.3 `npm test` (unit + workers) and the affected e2e specs pass
      locally.

## 6. Verify and ship

- [ ] 6.1 Check the built page at desktop and portrait-mobile widths
      (no horizontal overflow), light and dark mode.
- [ ] 6.2 `spec:` commit for the planning artifacts; `impl:` commit for
      the code and tests; push to deploy through Workers Builds; check
      `jaime.stream`.
- [ ] 6.3 Do not archive the change until it has been reviewed live.
