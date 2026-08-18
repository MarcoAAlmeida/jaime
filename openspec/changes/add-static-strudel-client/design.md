## Context

See proposal.md - Why. Reuses the stack decisions already made in
`docs/03-architecture-frontend.md` verbatim for this phase, scoped down
to one editor / one track: Nuxt 3 with `ssr: false` for the jam route,
CodeMirror 6, `@strudel/webaudio`, deployed via the Nitro `cloudflare`
preset.

## Goals / Non-Goals

**Goals:**
- Prove the Nuxt + CodeMirror + Strudel-webaudio + Cloudflare Workers
  stack works end-to-end, deployed to a real URL
- Shape `useJamSession()` now so Phase 2 (`add-room-relay`) only swaps
  its data source, not its interface

**Non-Goals:**
- Any WebSocket/Durable Object wiring (Phase 2)
- Track ownership or multiple simultaneous tracks (Phase 3)
- Persistence of any kind (Phase 5)

## Decisions

### Decision: Mount CodeMirror imperatively, not via a Vue component library
CodeMirror 6 is mounted imperatively in `onMounted` and themed via an
exhaustive `EditorView.theme()` (see `03-architecture-frontend.md`)
rather than relying on a Vue-CodeMirror wrapper library. This avoids
Tailwind preflight leaking into `.cm-*` internals and keeps full control
over editor behavior once collaborative cursors/ownership indicators are
added in later phases.

### Decision: `@strudel/webaudio` owns its own timing loop
The Strudel scheduler is not driven by Vue's render cycle — it runs its
own audio-accurate timing loop, with Vue only responsible for
start/stop/pattern-text plumbing. This avoids audio timing jitter tied
to browser paint/reactivity timing.

### Decision: Stub the state store now, not later
`useJamSession()` is created in this phase but holds only local editor
state (no `tracks`/`presence` from a WebSocket yet). This keeps the
Phase 2 diff small — the composable's shape doesn't change, only its
data source does. Alternative considered: skip the composable entirely
and add it in Phase 2 — rejected because it would force a component
API change (props/emits → composable) at the same time as the first
realtime integration, compounding risk.

### Decision: Deploy early
An early `wrangler deploy` to a real `*.workers.dev` URL happens in this
phase specifically to de-risk the Nitro `cloudflare` preset + Wrangler
config before any Durable Object complexity is added, per
`04-roadmap.md`.

## Risks / Trade-offs

- [Risk] Nitro `cloudflare` preset has edge cases with static asset
  hosting that only surface on a real deploy, not `wrangler dev` →
  Mitigation: task 4 explicitly deploys and manually verifies the live
  URL, not just localhost.
- [Risk] Building `useJamSession()` now, before its real shape is known
  from Phase 2's WebSocket protocol, risks guessing wrong → Mitigation:
  scope is deliberately minimal (local state only); if Phase 2 needs a
  different shape, the cost of changing it is small since nothing else
  depends on it yet.
