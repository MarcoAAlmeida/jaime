# Phase 3 — `@jah` knows the patterns

Read [README.md](./README.md) first.

**Goal:** the pattern library becomes searchable by musical character
and by the functions it uses, and `@jah` can offer real library patterns
as cards.

**Gate:** "something like this" and style eval cases (add them to the
Phase 0 set) return sensible library patterns.

Depends on Phase 1 (retrieval plumbing). Three changes, in order.

---

## Change `add-strudel-code-analysis`

**Why.** Several later steps need to understand code structurally: which
functions a pattern uses, where in the text a call sits, and the shape of
a mini-notation string. Build it once.

**Specs**
- **NEW capability `strudel-code-analysis`**. Given Strudel source it can:
  - **list the functions called**, including method chains such as
    `note(...).s(...).lpf(...)`;
  - **locate** a call or argument from a text position (used for
    selections in Phase 2 follow-ups and for errors in Phase 5);
  - **expose the mini-notation tree** of a string argument (sequences,
    alternation `<a b>`, polymeter, euclid `(3,8)`, repetition `*`);
  - **report syntax errors with a position** rather than only a message;
  - **check that every function called exists** in the Strudel docs
    index (Phase 1's corpus) — a cheap static check with no evaluation.
- The analysis must work in Node (for scripts) and, if practical, in the
  browser and Worker.

**Approach.** The parser is already installed: `@strudel/transpiler` uses
acorn, and `@strudel/mini` contains the mini-notation parser. Reuse them;
do not write a new parser. Decide in `design.md` whether it lives in
`shared/` (usable by server and client) or `scripts/`.

**Tests.** Fixture code covering method chains, nested patterns, mini
strings, and broken input; positions are exact.

**Out of scope.** Embedding trees (README decision 10), evaluation.

---

## Change `add-pattern-musical-features`

**Why.** A text embedding cannot hear music. Represent each pattern's
music first, then search that.

**Specs**
- **NEW capability `pattern-analysis`**. For each library pattern,
  deterministically derive:
  - **functions used** (from `add-strudel-code-analysis`);
  - **musical features** from the events the pattern produces over a few
    cycles, computed with the headless evaluator
    (`scripts/patterns/lib/triage.mjs`) and the mini-notation tree:
    pitch content (pitch classes, intervals, contour, range, key or mode
    where inferable), rhythm (onset density and grid, syncopation),
    tempo, the sounds used, and the number of layers;
  - a **short natural-language feature line** built from those numbers
    (for example "minor pentatonic melody, syncopated 16th hats, 4 layers,
    uses `.lpf` `.off` `stack`"), which a text embedding handles well.
  - patterns that produce no events (or fail) are marked as such, not
    skipped silently.
- **MODIFIES `pattern-library`**: derived metadata is stored with the
  pattern and is rebuilt when the pattern's code changes. Where it is
  computed and stored is Open Decision 3 (deploy reconcile vs. a
  refresh-style script committed to the repo) — ask the developer.

**Touch points.** `scripts/`, a new migration in `migrations/patterns/`,
`scripts/sync-patterns.mjs` if computed on deploy, `content/patterns/*.md`
if committed derived fields are chosen.

**Tests.** Feature extraction on fixture patterns with known answers
(a four-on-the-floor kick has a regular quarter-note grid; a C major
scale reports C major); failing patterns are marked; results are
deterministic.

---

## Change `add-pattern-similarity-search`

**Why.** "Something dubby and slow", "like this one", "uses `.off`".

**Specs**
- **MODIFIES `pattern-library`**: search additionally matches by
  musical/functional similarity, beyond the current text search.
- **MODIFIES `jah-grounding`**: patterns are a second retrieval source.
  `@jah` may answer with library patterns, shown as **code cards** (the
  existing card flow from `add-jah-code-cards`: Preview, Load into room),
  and credits each pattern's source and author.

**Retrieval.** Embed the *feature line + title + tags + author*, not the
raw code (README decisions 9–10). Mood and vibe come from the existing
human tags. Whether a vector index is needed at this library size (about
75 patterns today) or tags plus features suffice is decided by the eval.

**UX — discuss first.** How library results appear next to prose in a
reply (cards for patterns already exist for `@jah`'s own code).

**Tests.** Similarity ranks the fixture patterns sensibly; stubbed
embeddings in tests; the card path for library patterns.
