# Phase 4 — Enrich the patterns

Read [README.md](./README.md) first.

**Goal:** every library pattern carries a functional description — what
each function does *in that pattern* and why — written by `@jah` from the
code and the docs, reviewed by the developer.

**Gate:** the developer accepts the descriptions on review, and function
docs show real library examples.

Depends on Phases 1 and 3 (docs to ground the description, the AST for the
list of functions). One change.

---

## Change `add-pattern-functional-descriptions`

**Why.** Retrieval by function ("how do I use `.off`?") is strongest when
each function points to real patterns that use it, and when each pattern
explains its own technique. What the model writes must be **functional and
grounded in the docs**, never a claim about how the music feels — vibe
stays in the human tags (README decision 9).

**Prerequisite.** `add-pattern-ingestion-skill` is archived and its
capability is in `openspec/specs/pattern-ingestion/` (done 2026-09-21).

**Specs**
- **MODIFIES `pattern-library`**: a pattern may have a description
  field, kept in its `content/patterns/*.md` file and reconciled to the
  database like the other fields. Patterns without one keep working. See
  `content/patterns/README.md` for the file format.
- **MODIFIES `pattern-ingestion`**: the skill gains a *describe* step —
  it proposes a description for a new pattern as part of the review (the
  developer sees exactly what will be written, as today), never writing
  before approval.
- **MODIFIES `strudel-knowledge`**: each function chunk can list the
  library patterns that use it. Computed from the functions-used data
  (Phase 3), not from the model.

**Process**
1. A batch command drafts descriptions for existing patterns (using
   `@jah`'s knowledge, i.e. the Phase 1 corpus plus the pattern's
   functions and features) and writes them as **file changes the
   developer reviews as a diff** — never straight into the database.
2. Descriptions must be checkable: each function named must exist in the
   docs index, and each claim must be about what the function does to
   the pattern, per the docs.
3. The developer accepts, edits or drops each. Commit; CI reconciles.

**Rules.** Follow the ask-before-improvising rule: the batch runs only when
the developer asks. Fidelity of the code is unchanged (the code is never
touched).

**Tests.** File-format and reconcile tests for the new field (extend
`scripts/lib/patterns-manifest.test.mjs` and the write/sync tests);
the "used in" listing; the skill's spec scenarios.

**Out of scope.** Mood or genre judgments by the model, audio analysis.
