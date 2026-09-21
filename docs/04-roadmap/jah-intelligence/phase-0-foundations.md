# Phase 0 — Foundations

Read [README.md](./README.md) first (decisions, codebase map, ground rules).

**Goal:** know how good `@jah` is today, and make its reply code ready to
receive extra context, without changing any behaviour a user can see.

**Gate:** baseline scores exist and are committed; every existing `jah-*`
test passes unchanged.

Two changes, in this order.

---

## Change `add-jah-eval-harness`

**Why.** Every later phase must beat a number. Today the only measurement
is `scripts/jah-prompt-eval.mjs`, a one-off that scores prompt *variants*
on formatting (fenced, strudel-labelled, recoverable, silent, invented).
It says nothing about whether answers are *right*.

**Specs**
- **NEW capability `jah-eval`** (a developer workflow, like
  `pattern-ingestion`; it has a `## Purpose` and requirements with
  scenarios). It should require:
  - a **case set** in the repository, in a documented format, with three
    kinds of case (below);
  - a **run command** that sends every case through the *same* model call
    `server/jah/reply.ts` makes, and prints and saves a report;
  - **scoring that needs no model**, so it is unit-testable;
  - a **committed baseline** report so later runs can be compared;
  - the harness is **not part of `npm test`** (it spends real money) but
    its scoring code is covered by `npm run test:scripts`.

**Case kinds**

| Kind | Input | Scored by |
|---|---|---|
| `docs` | A question about Strudel (`what does .fast do?`, `how do I add reverb?`) | Expected function names appear in the answer; no function that does not exist is used; any code block evaluates |
| `fix` | Broken code plus the error message a user would see | The fixed code evaluates; it differs from the input; it still contains the parts that were not broken |
| `compose` | A request (`a four-on-the-floor beat with an offbeat hat`, `a slow bassline in A minor`) | The code evaluates; it satisfies simple structural constraints stated in the case (uses a named sound, has N layers, …) |

Aim for roughly 40 cases to begin with, spread across the kinds. Seed
`fix` cases with real errors (e.g. an undefined function, a bad
mini-notation string, a missing sound). Keep the case files small and
human-readable; where they live is decided in `design.md`.

**Build on what exists.** Reuse the model call setup and metrics in
`scripts/jah-prompt-eval.mjs` (remote Workers AI binding through
`getPlatformProxy`, `scripts/jah-prompt-eval.wrangler.jsonc`, `--samples`).
"Evaluates" means the same headless evaluator `pattern:check --fast`
uses: `createTriage` in `scripts/patterns/lib/triage.mjs`. Triage treats
"no events" as inconclusive, and the harness must too, not as a pass. A
"function exists" check needs the docs index, which arrives in Phase 1 —
until then it is skipped and reported as unavailable.

**Tests.** Scoring functions run against fixture replies (no model) in
`scripts/**/*.test.mjs`.

**Out of scope.** A model-as-judge for musical taste. Changing `@jah`.

**Acceptance.** `node <run command>` produces a report; the baseline for
today's `@jah` is committed; scoring tests pass in `npm test`.

---

## Change `add-jah-retrieval-seam`

**Why.** Phases 1–5 all add text to what the model sees (retrieved chunks,
the script, the selection, an error). Today `handleJahMention`
(`server/routes/composition.ts`) sends exactly one user message and
`JAH_SYSTEM_PROMPT` is a fixed constant. Make that pluggable first, with
no change in behaviour.

**Specs**
- **NEW capability `jah-grounding`**: reply assembly accepts optional
  *context blocks* placed in the model input, and an optional list of
  *sources* comes back with the reply. With no blocks the model input is
  exactly what it is today.
- **MODIFIES `jah-chat`**, requirement "Every `@jah` Reply Is Recorded":
  the audit record also captures how much retrieval a reply used
  (extend `ai_usage` with a new migration `0009_…` in
  `migrations/patterns/`; columns are decided in `design.md`, e.g.
  retrieval count and embedding tokens, defaulting to 0).

**Touch points**
- `server/jah/prompt.ts` — turn the constant `JAH_SYSTEM_PROMPT` into a
  builder that can include context blocks (keep the constant's output
  byte-identical when there are none).
- `server/jah/reply.ts` — `generateJahReply` takes the context and returns
  `sources`; extend `JahReply`.
- `server/routes/composition.ts` — `handleJahMention` passes context in.
- `server/auth/aiUsage.ts` — `recordUsage` writes the new fields.
- A test stub flag following `JAH_E2E`, so later retrieval can be faked
  (name decided in `design.md`).

**Tests.** Existing `test/jah-chat.test.ts`, `jah-reply.test.ts`,
`jah-route.test.ts`, `jah-caps.test.ts` pass **unchanged**; add tests that
context blocks appear in the assembled input and that sources round-trip.

**Out of scope.** Any actual retrieval, any UI.
