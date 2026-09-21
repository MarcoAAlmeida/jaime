# jaime

A browser-based app for multiple people to hang out and chat.

The chat has:

- AI chat participant named @jah
- support for [Strudel](https://strudel.cc) pattern code in real time
- ASCII art panel, synced to music

More panels and features are planned for future updates.


## Status

Live at `https://jaime.stream` — a Nuxt 4 + Nuxt UI 4 app on one
Cloudflare Worker (Durable Objects for rooms, D1 for content and domain
data, Workers AI for `@jah`). The one active roadmap is `@jah`
intelligence (`docs/04-roadmap/`); the specs describe what the app does
today, and this section is orientation. What exists:

- **Composition Room** (`/app/composition`) — the main room. One shared
  Yjs document (`y-codemirror.next`, the single Durable Object as
  authority) with live cursors, presence and room-synced playback, in
  three tabs: Chat (the default), Composition, ASCII Art. Everyone who
  joins is an editor (the viewer role stays in the code, unused). The
  Strudel engine is `StrudelMirror` + `app/lib/prebake.ts` /
  `app/lib/strudelEditor.ts`.
- **@jah** — the room's AI participant, shown as a red lion
  (`public/jah-avatar.svg`, a recoloured game-icons lion; the lion is a
  nod to the Lion of Judah, so keep any copy about it respectful). It
  answers `@jah <question>` in chat through Workers AI via the
  `jaime-jah` AI Gateway (`server/jah/`). Gated by sign-in plus
  `ai_access` (a per-user flag or `AI_ACCESS_LOGINS`), with caps and an
  `ai_usage` trail; `JAH_ENABLED` is the kill switch. The system prompt
  has no character yet.
- **ASCII art panel** — art that swaps on the beat, from a catalog
  scraped into `PATTERNS_DB` (`scripts/scrape-ascii-gallery.mjs`).
- **Pattern library** (`/app/patterns`) — curated Strudel patterns
  authored as `content/patterns/*.md` and reconciled into `PATTERNS_DB`;
  "Load into Composition Room" (and JAM) seeds a room with one via
  `?load=<patternId>`.
- **JAM** (`/app/jam`) — the older per-track jam room. Still works;
  being phased out.
- **Accounts** — passwordless email link and GitHub OAuth
  (`jaime_session` cookie; tables in `PATTERNS_DB`), an account page,
  and an operator-only `/admin` (`@jah` access, usage).
- **Content** — `/docs` (docs shell), `/articles` (long-form pieces),
  and the game-icons set bundled locally, with attribution in
  `content/credits/game-icons.md` (`icon-library` spec).
- **CI/CD** — Cloudflare Workers Builds; see Branching and deploys.

## Source of truth

- `openspec/specs/` — current behavior contracts, by capability
- `openspec/changes/` — in-flight work, one OpenSpec change per unit of
  work (finished ones move to `openspec/changes/archive/`)
- `docs/04-roadmap/` — the active `@jah` intelligence roadmap (start at
  `jah-intelligence/README.md`); planned work, not current behavior
- `docs/0N-*/index.md` (01–03) are background; treat them as
  informative, not authoritative — if they conflict with
  `openspec/specs/`, the spec wins. See `docs/99-openspec-adoption/index.md`
  for how the OpenSpec transition happened.

**Ignore every archive folder** — `docs/04-roadmap/01-archive/` and
`openspec/changes/archive/`. They are frozen history, not current
scope: do not read them for context, search them, cite them, or act on
anything found in them, and do not edit them unless explicitly asked.
Exclude them from searches. Current behavior is in `openspec/specs/`.


## App

Using Nuxt UI documentation from https://ui.nuxt.com/llms.txt
Follow complete Nuxt UI guidelines from https://ui.nuxt.com/llms-full.txt

Deploy with `npm run deploy` (build → apply the `PATTERNS_DB` D1
migrations `--remote` → reconcile the curated pattern catalog from
`content/patterns/*.md` → `wrangler deploy`), not `wrangler deploy`
alone — that would ship code against an un-migrated schema and a stale
catalog. Local dev and the test scripts run the same
migrate-then-sync `--local` first.

Typecheck with `npm run typecheck`: `nuxt typecheck` covers `app/`,
`server/` and `shared/`; `npm run typecheck:tests` covers `test/` and
`e2e/`, which it does not (`tsconfig.tests.json`, `tsconfig.e2e.json`).
`npm test` does not run it. Fix every error it reports rather than
leaving it as pre-existing.

## Branching and deploys

Single branch, `main`; OpenSpec commands run on `main`. Cloudflare
Workers Builds is connected to `MarcoAAlmeida/jaime`: **every push to
`main` runs `npm test` and then `npm run deploy`** (a failing test
stops the deploy). So a push is a deploy, and the policy follows from
that:

- Commit locally as often as needed; local commits are free. Do not
  push per fix.
- Push when a change is archived (the `spec: Sync …; archive …`
  commit), which carries everything committed since the last push.
- To try something in the real environment before then, run
  `npm run deploy` locally (it does not run the tests, and ships the
  working tree, committed or not).
- Before the archive push, run `npm test` locally — the push is the
  first time CI runs the suite, and a failure there leaves the archive
  commit un-deployed.
- Non-production branch builds are enabled (they run the tests and a
  no-op deploy), but no branches are used today.

The curated Pattern library is authored as one Markdown file per
pattern under `content/patterns/` (see its `README.md`), not SQL. The
deploy/`db:migrate:local` sync upserts them into D1 and prunes curated
rows dropped from the manifest; `origin='user'` rows are never touched.

The logo is the interlocked "ja" monogram — `design/assets/logo.png`
(source), `public/logo.png` (served), the favicon/PWA icon set. In-app
it's the mark alone via `<Logo>` (`app/components/Logo.vue`), no
wordmark. `design/assets/jaime-logo.jpg` is an old concept render (blue
primary) — do not use it.

## Layout

Single project, not a monorepo — no nested `AGENTS.md` files. A sibling
project, `jaime-games`, lives in its own repo and deploys to
`games.jaime.stream`; jaime's palette and logo are copied there by hand.

## Commits

Past tense, typed by SDD lifecycle stage, not by code shape:

- `spec:` — planning artifacts landed (proposal/design/specs/tasks), no
  code changed yet
- `impl:` — implementation done and tested locally
- `fix:` — correction only testable after deployment
- `chore:` — anything outside the spec→impl→fix arc

One `spec:` commit per change before touching code, one `impl:` commit
once it works locally, `fix:` commits after if deploy-only behavior needs
correcting.
