# jaime

A browser-based app for multiple people to jam together using
[Strudel](https://strudel.cc) pattern code in real time — a shared jam
room where each person owns one track, types patterns into their own
editor, and hears everyone's tracks mixed locally, locked to the same
tempo. See `docs/01-project-overview.md` for the full picture.

## Status

Pre-Phase-1: no application code has been written yet. Phase 1
(`add-static-strudel-client`) is scaffolded as the first OpenSpec change
— see `openspec/changes/add-static-strudel-client/`.

## Source of truth

- `openspec/specs/` — current behavior contracts, by capability
- `openspec/changes/` — in-flight and archived work, one OpenSpec change
  per roadmap phase
- `docs/04-roadmap.md` — phase-level index, evolves as work lands
- `docs/0N-*.md` (01–03) are background written before OpenSpec adoption;
  treat them as informative, not authoritative — if they conflict with
  `openspec/specs/`, the spec wins. See `docs/05-openspec-adoption.md`
  for why and how this transition is happening.

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
