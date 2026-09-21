# Phase 6 — `@jah` the composer

Read [README.md](./README.md) first.

**Goal:** `@jah` writes new pieces on request, informed by the docs and
by the library, and never presents code it has not checked.

**Gate:** `compose` eval cases produce code that evaluates and meets the
structural constraints at a target rate agreed with the developer.

Depends on Phases 1, 3, 4 and 5 (docs, similar patterns as style
examples, functional descriptions, and the verify-and-repair step). One
change.

---

## Change `add-jah-composer`

**Why.** With the docs, the patterns and a verify step in place,
composition is mostly assembly: retrieve similar patterns as examples,
write, verify, repair, present.

**Specs**
- **NEW capability `jah-composition`**: a request to compose returns a
  code card containing a piece that **passed the same verification as
  Phase 5** (static function check, evaluation where available, bounded
  repair). The reply states plainly when it could not produce a passing
  piece. It uses only sounds available in the app (default sample map and
  the packs the app loads); a piece that needs another pack loads it in
  its own code, the way library patterns do (see the `frontend-editor`
  "Sample Playback" requirement). Credit library patterns used as
  inspiration where the reply relies on them.
- **MODIFIES `jah-chat`**: the model selector (currently a placeholder
  that only shows a "not implemented" toast) may become real if the
  eval shows different models suit different requests. Decide with the
  developer; leave the placeholder if not.

**Retrieval for composition.** Use the Phase 3 similarity search to pull a
few library patterns close to the request (their code and functional
descriptions) as style examples in the context, alongside the relevant
function chunks from Phase 1.

**Model.** Likely a stronger model through the AI Gateway than the
current default (README Open Decision 5). Composition is the most
expensive request kind: revisit per-user and global caps and the
`ai_usage` cost estimate (`server/jah/reply.ts` has per-token prices for
the current model only) before enabling it broadly.

**Boundary.** As everywhere: `@jah` proposes, a human applies (Phase 5's
Apply overwrites the whole document).

**Tests.** Stubbed model; verification is enforced (a canned reply with a
non-existent function is repaired or refused); cost recording for the
routed model; caps.

**Out of scope.** Audio analysis, `@jah` editing the document itself,
memory across sessions.
