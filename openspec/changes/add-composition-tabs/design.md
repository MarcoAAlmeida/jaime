## Context

`app/pages/app/composition/[id].vue` currently lays out the room as: a
main pane holding the CodeMirror editor + its `@strudel/draw` canvas
backdrop, plus two independently-toggleable `<aside>` overlays —
`ascii-panel` and `side-panel` (roster + chat stacked in one aside) —
each with its own local ref (`showAsciiPanel`, `panelOpen`) and its own
header toggle button. On `md+` both asides become flex siblings of the
editor (`md:static`); below `md` both are `absolute inset-y-0 right-0
z-30` overlays occupying the same screen position, so opening both at
once means one covers the other. See proposal.md for the "Why."

## Goals / Non-Goals

**Goals:**
- Replace the docked-panel layout with a tab shell holding exactly
  three views, reusing each view's existing internal markup/logic
  (editor+canvas, roster+chat, ASCII art) essentially unchanged —
  this is a container swap, not a rewrite of what's inside each view.
- Keep tab selection fully local/per-viewer, matching the reactivity
  model the two panel refs already use today.
- Lay out Chat's body with a reserved, currently-empty control-strip
  region for `add-jah-chat`'s future controls.

**Non-Goals:**
- Building any file-upload, model-selection, or parameter-control
  functionality — layout reservation only (see proposal.md).
- Changing the Yjs document model, presence protocol, chat broadcast,
  or transport-clock mechanics — all unchanged, only their presentation
  moves.
- A settings UI for the keyboard shortcuts or tab order — shortcuts are
  fixed (`1`/`2`/`3`), consistent with this project's general
  preference for fixed, simple defaults over configurability (e.g. the
  ASCII panel's non-adjustable opacity).

## Decisions

**A single `activeTab` ref (`'composition' | 'chat' | 'ascii'`)
replaces `showAsciiPanel` and `panelOpen`.** Both booleans allowed
independent, overlapping states that the new model deliberately
forbids; a single three-way enum makes "exactly one visible" the only
representable state, rather than a boolean pair whose four
combinations must be constrained by convention. Default: `'composition'`
— the editor stays the tab you land on when joining a room, matching
today's default-visible pane.

**Tab bodies keep their existing internal structure, just re-parented.**
The roster markup, the chat log/input markup, and the ASCII art
markup are lifted into their tab's body largely as-is; the goal is a
container change, not a rewrite of chat, presence, or ASCII rendering
logic (all of which have their own working e2e coverage today).

**The tab switcher is one component, two placements.** Rather than a
"desktop nav" and a wholly separate "mobile nav," a single set of
tab-button definitions (icon, label, activity-indicator state) renders
into the header at `md+` and into a `fixed bottom-0` bar (with
`env(safe-area-inset-bottom)` padding, matching this project's existing
mobile-safe-area convention — see `responsive-rooms`) below `md`. This
avoids the two-implementations-drift risk of hand-rolling both.

**Playback state indicator reads the same `isPlaying` state the
Composition tab's canvas/transport logic already tracks.** No new
state — just rendered in the header (a small dot/icon + label) instead
of only implicitly visible via the canvas animating.

**Activity indicators are two independent booleans, not a shared
"unread" concept.** `chatHasActivity` flips true on an incoming chat
message while `activeTab !== 'chat'`, clears on switching to Chat —
this already exists today as the `unread` count on `toggle-panel-button`,
just relocated and simplified to a boolean-or-count on the tab itself
(keep the existing count display, since it's already implemented and
tested). `compositionHasActivity` is new: flips true when an evaluation
broadcast is received while `activeTab !== 'composition'`, clears on
switching to Composition. Both are per-viewer local state, not synced.

**Clear-document reuses the evaluate broadcast path, not a new message
type.** Clearing sets the shared Yjs document's text to empty and lets
the existing document-sync mechanism propagate it — the same path any
other edit takes, so no new realtime protocol surface is introduced.
The control is rendered only when the local participant's role is
`editor` (same check already used to disable typing for viewers), and
an inline confirm/cancel step — matching `account.vue`'s existing
destructive-action pattern, not a modal — gates the actual clear,
consistent with this project's general pattern of confirming
destructive, hard-to-reverse actions.

## Risks / Trade-offs

- **Existing e2e coverage assumes the old panel model** —
  `e2e/composition.spec.ts` (roster/chat visibility, panel toggling),
  `e2e/ascii-panel.spec.ts` (ascii panel toggle/visibility), and
  `e2e/mobile-rooms.spec.ts` (header-button-based responsive checks)
  all query `data-testid="side-panel"` / `"ascii-panel"` /
  `"toggle-panel-button"` / `"toggle-ascii-panel-button"` directly →
  these will fail against the new markup and need rewriting against
  tab testids as part of this change's tasks, not treated as
  pre-existing/unrelated failures the way the `oauth.spec.ts` flake was
  in `add-articles`.
- **`e2e/oauth.spec.ts`'s avatar-in-room test clicks `role-editor` then
  expects the editor visible** — with tabs, the editor is only visible
  on the Composition tab; if that test's flow lands on a different
  default tab this need adjusting too, though the plan is to default
  to Composition, so this is likely unaffected in practice — verify
  during implementation rather than assume.
- **Losing the always-visible editor is a real UX trade-off**, already
  discussed and accepted by the user in the change's proposing
  conversation: switching to Chat or ASCII means you can't see or type
  into the document until switching back. The playback indicator and
  the composition-activity badge are the mitigations, not a full
  substitute.
- **Reserved Chat control-strip space with nothing in it yet** risks
  looking like a visible placeholder/dead space if not sized subtly →
  keep it collapsed to zero height until `add-jah-chat` actually
  populates it, rather than reserving visible empty chrome now.

## Migration Plan

No user data, schema, or persistence changes — this is a client-side
layout and interaction change. Suggested build order (one
implementation pass, not user-gated slices, per proposal.md):

1. Introduce the `activeTab` ref and the tab-shell scaffold (three
   containers, one rendered at a time), moving today's editor/canvas,
   roster+chat, and ASCII art markup into their respective tab bodies
   with no other behavior change yet.
2. Wire the responsive tab switcher (header on `md+`, bottom bar
   below) and the keyboard shortcuts.
3. Add the playback indicator and the two activity indicators.
4. Add the role-gated, confirmed clear-document control.
5. Reserve (empty, zero-height) layout space in Chat's body for
   `add-jah-chat`.
6. Rework the affected e2e suites against the new tab-based testids.

Rollback is a normal git revert — no data migration to undo.
