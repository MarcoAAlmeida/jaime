# jaime

A browser-based app for multiple people to jam together using
[Strudel](https://strudel.cc) pattern code in real time — a shared jam
room where each person owns one track, types patterns into their own
editor, and hears everyone's tracks mixed locally, locked to the same
tempo. See `docs/01-project-overview/index.md` for the full picture.

JAM — the room / track-ownership / transport-clock tool built across
the first roadmap (archived at `docs/04-roadmap/01-archive/`) — is
implemented and shipped.

## Status

jaime is a hub for small music-oriented tools, with JAM as the first
tool. Phase 1 of the tools-hub roadmap (`docs/04-roadmap/index.md`) —
visual identity, the three layout shells, JAM re-routed under
`/app/jam`, the `jaime.stream` domain, and click-through mocks — is
implemented, deployed, and archived
(`add-tools-hub-visual-identity`). The site is live at
`https://jaime.stream`. Phase 2 (domain model + persistence) is next
and has no OpenSpec change yet.

## Source of truth

- `openspec/specs/` — current behavior contracts, by capability
- `openspec/changes/` — in-flight and archived work, one OpenSpec change
  per roadmap phase
- `docs/04-roadmap/index.md` — phase-level index for the current
  roadmap, evolves as work lands; the prior roadmap is archived at
  `docs/04-roadmap/01-archive/`
- `docs/05-domain-model/index.md` — entities, value objects,
  aggregates, and bounded contexts for the current roadmap
- `docs/06-user-stories/index.md` — user stories by journey, for the
  current roadmap
- `docs/0N-*/index.md` (01–03) are background written before OpenSpec
  adoption; treat them as informative, not authoritative — if they
  conflict with `openspec/specs/`, the spec wins. See
  `docs/99-openspec-adoption/index.md` for why and how this transition
  is happening.


## App

Using Nuxt UI documentation from https://ui.nuxt.com/llms.txt
Follow complete Nuxt UI guidelines from https://ui.nuxt.com/llms-full.txt

Deploy with `npm run deploy` (build → apply the `PATTERNS_DB` D1
migrations `--remote` → `wrangler deploy`), not `wrangler deploy` alone
— that would ship code against an un-migrated schema. Local dev and the
test scripts apply the migrations `--local` first.

The logo is the interlocked "ja" monogram — `design/assets/logo.png`
(source), `public/logo.png` (served), the favicon/PWA icon set. In-app
it's the mark alone via `<Logo>` (`app/components/Logo.vue`), no
wordmark. `design/assets/jaime-logo.jpg` is an old concept render (blue
primary) — do not use it.

## Layout

Single project, not a monorepo — no nested `AGENTS.md` files yet. If
independent sub-projects (e.g. a separate backend worker) emerge, split
this file then, not before.

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
