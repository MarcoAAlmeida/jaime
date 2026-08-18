# OpenSpec adoption

## Intent

Going forward, `openspec/specs/` and `openspec/changes/` are the source of
truth for this project's behavior and in-flight work — not the numbered
`docs/0N-*.md` files. Those docs got the project from zero to this point,
but once OpenSpec is initialized, the numbered docs may be dropped, merged
into spec/design artifacts, or changed without notice. Anyone joining the
project later should look in `openspec/`, not `docs/`, for the current
state of things.

Phase 1 (`add-static-strudel-client`) has been scaffolded and is live at
`openspec/changes/add-static-strudel-client/` — see that directory for the
actual proposal, design, specs, and tasks, not this doc. **Phases 2 onward
will be scaffolded and drafted directly by Claude Code CLI**, working from
the roadmap table below and the existing architecture docs before they're
retired.

## Why now

jaime is pre-Phase-1 (see `04-roadmap.md`) — no code has been written yet.
Adopting [OpenSpec](https://github.com/Fission-AI/OpenSpec) at this point
means the first change (`add-static-strudel-client`) starts from a clean
slate: no deltas needed yet, just a first spec.

Going forward, each roadmap phase becomes one OpenSpec change. `docs/02-*`
and `docs/03-*` stay as-is — they're effectively a pre-written `design.md`
for the backend and frontend respectively (technical approach, not
behavior contracts). As each phase's change is archived, the *behavior*
promises embedded in those docs get extracted into `openspec/specs/*/spec.md`
as formal Requirements + Scenarios. `docs/04-roadmap.md` stays as the
phase-level index; OpenSpec changes are the phase-level execution unit.

| Roadmap phase | OpenSpec change | Spec domain(s) touched |
|---|---|---|
| 1. Static client | `add-static-strudel-client` | `frontend-editor/` |
| 2. Single room relay | `add-room-relay` | `realtime-room/` |
| 3. Ownership + clock sync | `add-track-ownership-and-clock` | `track-ownership/`, `transport-clock/` |
| 4. Multi-room + presence | `add-multiroom-presence` | `realtime-room/` (delta), `presence/` (new) |
| 5. Persistence + reconnect | `add-persistence-reconnect` | `persistence/` |
| 6. Identity + polish | `add-identity-polish` | `frontend-editor/` (delta) |

## Setup

Already done for this project — kept here for reference when scaffolding
future phases.

```bash
npx @fission-ai/openspec@latest init --tools claude
```

Note the scoped package name (`@fission-ai/openspec`, not `openspec` —
that name is squatted by an unrelated package on npm) and the required
`--tools claude` flag. This scaffolds `openspec/` (with `specs/`,
`changes/`, `config.yaml`) and installs Claude Code skills/commands under
`.claude/` (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`,
`/opsx:explore`) for driving the propose → apply → archive workflow.

The default `spec-driven` schema (`proposal → specs → design → tasks`)
fits this project as-is — no custom schema needed.

To scaffold a new phase's change:

```bash
openspec new change <change-name> --description "<short description>"
```

Then populate `proposal.md`, `design.md`, `specs/<capability>/spec.md`,
and `tasks.md` — either via `/opsx:propose`, or by pulling
`openspec instructions <artifact-id> --change <change-name> --json` for
each artifact's current template and authoring rules (these evolve with
the tool, so always check them rather than assuming the last change's
format still applies).

## Next steps

1. Work Phase 1 tasks in
   `openspec/changes/add-static-strudel-client/tasks.md`, checking items
   off.
2. When Phase 1 is done, `openspec archive add-static-strudel-client` —
   this seeds `openspec/specs/frontend-editor/spec.md` for real.
3. **From Phase 2 onward, hand drafting off to Claude Code CLI directly**:
   have it create each subsequent change (`add-room-relay`,
   `add-track-ownership-and-clock`, `add-multiroom-presence`,
   `add-persistence-reconnect`, `add-identity-polish`) by pulling behavior
   content out of `docs/02-architecture-backend.md` and
   `docs/03-architecture-frontend.md` into proper delta specs — before
   those docs are dropped or rewritten. Once a phase's content has been
   captured in `openspec/specs/`, its source doc in `docs/` is no longer
   authoritative and can be pruned.
