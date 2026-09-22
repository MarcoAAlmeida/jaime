# `@jah` eval harness

Measures how good `@jah`'s answers are, against the real model, so every
later change to `@jah` (see `docs/04-roadmap/jah-intelligence/`) can be
judged against a number instead of an opinion. Full behaviour contract:
`openspec/specs/jah-eval/spec.md` (once synced) or
`openspec/changes/add-jah-eval-harness/specs/jah-eval/spec.md` until then.
Design decisions: `openspec/changes/add-jah-eval-harness/design.md`.

**It costs real (tiny) amounts of money and is never run by `npm test` or
CI.** Run it yourself, when you want a number.

## Setup

```
npx wrangler login   # once — Workers AI is a remote binding
```

## Commands

```
node scripts/jah-eval/run.mjs                       # run the full case set, 3 samples each
node scripts/jah-eval/run.mjs --samples 5            # more samples per case
node scripts/jah-eval/run.mjs --kinds docs,fix       # only these kinds
node scripts/jah-eval/run.mjs --case fast-basic,undefined-function
node scripts/jah-eval/run.mjs --out ./my-report.json # save the report here instead of the OS temp dir
node scripts/jah-eval/run.mjs --save-baseline        # also overwrite baseline.json
node scripts/jah-eval/run.mjs --compare              # also print the diff against baseline.json
node scripts/jah-eval/run.mjs --validate             # no model call — checks the case set itself
```

`npm run jah:eval` is the same as `node scripts/jah-eval/run.mjs`, so
`npm run jah:eval -- --compare` works too.

A run prints a summary (pass/fail/inconclusive/error counts and rates, per
kind and overall, plus every failing case and its reason) and saves the
full report — every reply, every check result — to a file (printed at the
end). The default location is the OS temp directory, so a run never leaves
the working tree dirty.

`--save-baseline` is the only thing that writes `baseline.json`, the
committed file compared runs are measured against. It holds the same
report with reply texts stripped out, so its diffs stay small and
readable. Overwrite it deliberately, after a review — see "Updating the
baseline" below.

## The case set

Cases live in `cases/docs.mjs`, `cases/fix.mjs`, `cases/compose.mjs`, each
exporting a plain array. Every case is a `.mjs` object literal (not JSON or
markdown) because `fix` cases hold real, multi-line Strudel code full of
quotes and backticks — a template literal is the most readable way to
write that.

Every case has:

| Field | Required | Meaning |
|---|---|---|
| `id` | always | kebab-case, unique across the whole set |
| `kind` | always | `'docs'` \| `'fix'` \| `'compose'` |
| `message` | `docs`/`compose`; optional for `fix` | the text a user would type to `@jah` |

**`docs`** (a question about Strudel):

| Field | Meaning |
|---|---|
| `expect` | non-empty array of function names a correct answer must mention (whole word, case-insensitive, a leading `.` is fine either way) |
| `forbid`? | function names that must NOT appear |
| `code`? | `'required'` if the answer must contain code that evaluates; omit for no requirement |

**`fix`** (broken code plus its error):

| Field | Meaning |
|---|---|
| `broken` | the broken Strudel code |
| `error` | the error message a user would see (run `--validate` to check this against what the evaluator actually produces) |
| `keep`? | fragments (exact substrings, once whitespace is collapsed) the fix must not discard |

If `message` is omitted, the harness sends a default ("This won't run — can
you fix it?") followed by the error and the broken code in a fence, the
way a user pastes a failure today.

**`compose`** (a request to write a piece):

| Field | Meaning |
|---|---|
| `mustUse`? | names the code must contain |
| `mustNotUse`? | names the code must NOT contain |
| `minEvents`? | minimum musical events the code must produce over a few cycles (default 1) |

### Adding a case

1. Add an object to the right `cases/*.mjs` array.
2. For a `fix` case, run `--validate` and copy the "actual" error it prints
   into the case's `error` field (or close enough — the field is
   informational, not compared exactly).
3. `npm run test:scripts` — `lib/cases.test.mjs` includes a test that the
   real committed set is well-formed, so a bad case fails fast, offline.

### Validating the case set

```
node scripts/jah-eval/run.mjs --validate
```

Checks every case is well-formed (this always runs, even for a normal run
— a malformed set is refused before any model call), then evaluates every
`fix` case's `broken` code and confirms it genuinely fails. A `fix` case
whose code accidentally works (as happened once here: `.lpd` looked
invented but is a real low-pass-decay control) measures nothing and is
reported invalid.

## How code is judged

The reply's first fenced code block labelled `strudel` (or, failing that,
the first block the chat would still turn into a card) is evaluated with
the same headless Strudel evaluator `npm run pattern:check -- --fast` uses.
A pattern that raises an error or asks for a sound the app doesn't load
**fails**; one that evaluates but produces no events is **inconclusive**
— not a pass, always shown separately, because triage cannot always
distinguish "broken" from "would need the browser". A reply with no
usable code block at all is **no code**.

## The function-existence check

Every report includes a check that every function a reply's code calls
actually exists in Strudel. Until `docs/04-roadmap/jah-intelligence/`
Phase 1 builds a documentation index, this always reports **unavailable**
— visible in the report's `unavailable` list, never silently skipped, and
never counted as a pass or a fail for any case.

## Updating the baseline

The baseline is what later runs are compared against, so overwrite it
deliberately, not as a side effect of a normal run:

```
node scripts/jah-eval/run.mjs --save-baseline
```

Do this with a clean working tree (the report's `revision` field records
`+dirty` otherwise, which makes the baseline unreproducible) and after
`@jah`'s prompt or model has genuinely changed and you want the new normal
recorded — or the very first time, to capture where things stand today.
`--compare` afterwards shows nothing moved until the baseline changes.

## What this does not do

- It does not call a model-as-judge — every check is deterministic.
- It is not a substitute for the real playback gate
  (`e2e/pattern-playback.spec.ts`, via `npm run pattern:check`); it uses
  the same fast, headless triage that gate's `--fast` mode uses, which
  reports `inconclusive` rather than a real pass on some patterns that do
  play in a browser.
- It never touches `ai_usage` or the daily reply caps — a run is invisible
  to production accounting.
