# jaime

A browser-based app for multiple people to jam together using
[Strudel](https://strudel.cc) pattern code in real time — a shared jam
room where each person owns one track, types patterns into their own
editor, and hears everyone's tracks mixed locally, locked to the same
tempo. See `docs/01-project-overview/index.md` for the full picture.

JAM — the room / track-ownership / transport-clock tool built across
the first roadmap (archived at `docs/04-roadmap/01-archive/`) — is
implemented and shipped. `add-identity-and-transport-ui`, its final
change, is implemented and deployed but not yet archived in OpenSpec
— see `openspec/changes/add-identity-and-transport-ui/`.

## Status

jaime is pivoting from a single-purpose jam app to a hub for small
music-oriented tools, with JAM as the first tool rather than the whole
product. The next roadmap (`docs/04-roadmap/index.md`) is in planning:
its domain model and user stories are worked out, but no
implementation has started yet — no OpenSpec change exists for it.

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
