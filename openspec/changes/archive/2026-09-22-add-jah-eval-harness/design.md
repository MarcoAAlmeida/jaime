## Context

See `proposal.md` for why. This is Phase 0 of `docs/04-roadmap/jah-intelligence/`
(read its `README.md` for the decisions already taken); the eval built here
gates every later phase.

What exists and constrains the approach:

- **`scripts/jah-prompt-eval.mjs`** already runs `@jah`'s prompt against the
  real model from Node. It uses the remote Workers AI binding through
  `getPlatformProxy` with `scripts/jah-prompt-eval.wrangler.jsonc` (only the
  `AI` binding — loading the app's own config drags in Durable Object, D1 and
  asset bindings and locks `.output/public`), and deliberately bypasses the AI
  Gateway so a measurement does not pollute production logs. Its scoring is
  formatting-only (`fences`, `balanced`, `score`).
- **`server/jah/reply.ts`** makes the real call: model
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `system: JAH_SYSTEM_PROMPT`,
  `messages: [{ role: 'user', content: mention.rest }]`. It imports
  `./prompt` **without a file extension**, which Node's ESM loader cannot
  resolve, and is typed against the app's `Env`. `server/jah/prompt.ts` has no
  imports, so Node can import it directly (the existing script does).
- **`scripts/patterns/lib/triage.mjs`** — `createTriage()` returns
  `{ check(code) }` giving `pass | error | missing-sounds | inconclusive`
  (plus `error`, `missing`, `events`, `notes`). It evaluates with the real
  Strudel packages in Node and queries a few cycles. It is a *triage*, not
  the gate: patterns with no events are `inconclusive`, and a Node-only error
  may be a helper the browser REPL provides. It mutates `globalThis.samples`
  per check, so checks must run one at a time. Building it fetches the sample
  bank maps from GitHub (`loadKnownSounds`), so it needs a network.
- `npm run test:scripts` runs `node --test "scripts/**/*.test.mjs"` and is
  part of `npm test` (so of CI); `pool-workers` vitest is unrelated.
- Windows/Git Bash: scripts, not inline heredocs, for anything with
  backslashes.

## Goals / Non-Goals

**Goals:**
- One command that measures `@jah` on right-or-wrong questions, not just
  formatting, and writes a number that can be compared later.
- Scoring that is pure and unit-testable, so the harness's own correctness is
  covered by CI even though running it is not.
- A seam for the function-existence check that Phase 1 fills in.

**Non-Goals:**
- Judging musical taste, or using a model as judge.
- Making `@jah` better, or changing any product code, prompt, protocol or
  database.
- Feeding `@jah` the script, selection or error through any channel other than
  the message text (that arrives in Phases 2 and 5 and will add a context
  mode to the harness then).
- Running in CI, or on a schedule.
- The real-browser check. Triage's "no events is inconclusive" is accepted
  and surfaced, not fixed.

## Decisions

### 1. Layout, under `scripts/jah-eval/`

```
run.mjs            CLI: run | --validate | --compare | --save-baseline
lib/cases.mjs      load + validate the case set, fingerprint it
lib/replies.mjs    fences, balanced, formatting score, primary-block choice
                   (shared with jah-prompt-eval.mjs)
lib/model.mjs      the model call (same model id and system prompt as reply.ts)
lib/score.mjs      pure per-kind scoring: (case, reply, evalOutcome) → verdict
lib/functions.mjs  the function-existence seam (unavailable today)
lib/report.mjs     summary, report object, fingerprints, baseline compare
cases/{docs,fix,compose}.mjs
baseline.json      the committed baseline
*.test.mjs         beside each lib file
```

`package.json` gains `"jah:eval": "node scripts/jah-eval/run.mjs"`. Kept
under `scripts/` like `scripts/patterns/`, so it is found by the existing
`test:scripts` glob and is clearly a developer tool. Alternative: a top-level
`eval/` directory — rejected, no reason to add a new top-level home.

### 2. "Same model call" means the same model and prompt, guarded against drift

The harness does **not** import `generateJahReply`: `reply.ts` cannot be
loaded by Node (extensionless relative import) and wants an app `Env`.
Options considered:

- *Change `reply.ts`* to a `.ts` import specifier, or extract a tiny
  `server/jah/model.ts` — rejected: product code churn for a tooling need, and
  the next Phase 0 change (`add-jah-retrieval-seam`) reworks `reply.ts` anyway.
- *A TypeScript loader dependency* — rejected: a new dependency for one file.
- **Chosen:** `lib/model.mjs` makes its own `generateText` call with the same
  model id and `JAH_SYSTEM_PROMPT` imported from `server/jah/prompt.ts`, and a
  **drift-guard test** reads `server/jah/reply.ts` as text and asserts it uses
  the same model id literal, passes `JAH_SYSTEM_PROMPT` as `system`, and sends
  the mention text as a single user message. This is the same pattern
  `triage.test.mjs` already uses to keep its sound banks aligned with
  `app/lib/prebake.ts`.

The AI Gateway is not used (as in the existing script), which also makes "not
recorded in `ai_usage`, no caps consumed" true by construction: the harness
never goes through the server's mention path.

### 3. Case files are `.mjs` modules exporting an array

Fix cases hold multi-line Strudel code full of quotes and backticks. JSON
needs every newline escaped; markdown needs fence-length handling (the reason
`add-pattern-ingestion-skill` had to fix `extractCode`). A `.mjs` module with
template literals is the most readable and needs no parser. It is executable
code in a developer-only, committed, reviewed file. Alternative: YAML — a new
dependency for no gain.

Fields (validated in `lib/cases.mjs`):

```
common   id (kebab-case, unique), kind, message
docs     expect: string[] (≥1)   forbid?: string[]   code?: 'required'|'optional'
fix      broken: string          error: string       keep?: string[]
compose  mustUse?: string[]      mustNotUse?: string[]   minEvents?: number (default 1)
```

The text sent to the model: docs and compose send `message`; fix sends
`message` (default "This won't run — can you fix it?") followed by the error
and the broken code in a `strudel` fence, because that is what a user would
paste today. Names are matched as whole words; `keep` fragments as exact
substrings after collapsing whitespace.

### 4. Scoring is pure; evaluation is injected

`score(case, reply, evalOutcome)` takes the evaluator's result as an argument
and returns the per-check results and one sample verdict: `pass`, `fail`,
`inconclusive` (all checks hold but the code produced no events), or `error`
(the model call failed — assigned by the runner, not the scorer). The runner
calls `createTriage().check(code)` for the reply's primary block and passes the
outcome in, so every scoring test runs on recorded replies with a fake
outcome and no network. Alternative: scorer calls triage itself — rejected,
it would make tests need the network and the GitHub sample maps.

Primary block: the first fence labelled `strudel`; otherwise the first fence
the chat would accept (labelled `js`/`javascript`, unlabelled, or with the
label on the following line — the tolerant rules the existing script's
`recoverable` uses). The formatting measures (`fenced`, `strudel`,
`recoverable`, `silent`, `invented`) are computed for every reply, moved
unchanged into `lib/replies.mjs`.

### 5. Results are per sample; a case has a pass rate

The model varies, so each case is sampled (`--samples`, default 3). Results
are counted per sample; a case's pass rate is its passing samples over all its
samples; errored samples count against it. Summary and comparison work on
sample counts and pass rates, not on a per-case pass/fail that would hide the
variance. Concurrency: model calls run four at a time; evaluation afterwards,
one at a time (triage mutates a global).

### 6. Report, fingerprints, baseline

The report is a JSON object: `version`, `ranAt`, `model`, `promptFingerprint`
(short sha-256 of the system prompt), `caseSetFingerprint` (sha-256 of the
cases normalised and sorted by id), `samples`, `revision` (`git rev-parse
--short HEAD`, with `+dirty` when the tree has changes), `unavailable` (the
checks that could not run, with reasons), `results` (per case, per sample: the
reply, the primary block, code verdict and detail, per-check results,
formatting measures, or the error) and `summary`. It is written to the OS
temp directory by default (`--out` chooses another), so a run leaves the tree
clean.

`--save-baseline` writes `scripts/jah-eval/baseline.json`: the same object
without reply texts and code blocks, so the committed file stays small and its
diffs are readable. Nothing else writes that file. `--compare` reads it and
prints the change in pass rate per kind and overall, the cases whose pass rate
moved (before → after), and a plain statement of what differs between the two
runs (model, prompt fingerprint, case-set fingerprint, sample count). Cases in
only one of the two are listed and not counted. A differing prompt is expected
— that is what later phases change — so it is stated, never a refusal.

### 7. The function-existence seam

`lib/functions.mjs` exports `loadFunctionIndex()`, which returns
`{ available: false, reason: 'no documentation index yet (roadmap Phase 1)' }`
today. The scorer's function check reads it: unavailable → recorded as
unavailable, counted as neither pass nor fail, listed in the report's
`unavailable`. Phase 1 makes it return the index and supplies the call
extraction; no case changes. Extracting called names from code is left to that
phase (it may use the Phase 3 code analysis) — inventing a regex now would be
throwaway work.

### 8. Validation mode

`--validate` loads the set (structural checks first, nothing else runs if
they fail), then evaluates every fix case's `broken` code with triage and
requires `error` or `missing-sounds`. A `pass` or `inconclusive` marks the
case invalid. It also prints, for each fix case, the error the evaluator
produced next to the case's stated `error`, so the developer can make the
stated error the real one (the authoring workflow in task group 4). It needs
the network (sample maps) and no model.

### 9. Sharing the reply helpers with the older script

`fences`, `balanced`, the `REAL_PACKS` and `UNLOADED_SOUNDS` constants and the
formatting `score` move into `lib/replies.mjs`; `scripts/jah-prompt-eval.mjs`
imports them instead of carrying copies. Its behaviour and output are
unchanged; a unit test pins the helpers' outputs on fixtures. That script
stays: it compares prompt *variants*, which the harness does not.

## Risks / Trade-offs

- **[Sampling noise hides small gains]** → Run the baseline twice when
  recording it and note the spread in the task record; later deltas smaller
  than the spread are not evidence. Three samples per case is a starting
  point, adjustable.

  **Recorded baseline (task 7.1, 2026-09-22, revision `780a96a+dirty`, 40
  cases × 3 samples, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`):**

  | | run 1 (saved as baseline) | run 2 | spread |
  |---|---|---|---|
  | overall | 86% | 87% | 1 point |
  | docs | 90% | 90% | 0 points |
  | fix | 90% | 90% | 0 points |
  | compose | 73% | 77% | 4 points |

  The compose spread is one case (`panning-drums`, 33% → 67% — a single
  sample flipping from fail to pass across the two runs) rather than a
  broad shift; every other case's pass rate was stable across the two
  runs. `scripts/jah-eval/baseline.json` holds run 1. A later comparison
  smaller than about 4 points in `compose`, or than the sampling noise
  visible in a fresh two-run check, is not yet evidence of a real change.

  Every failure inspected by hand was a genuine model mistake, not a
  harness artifact worth noting here: e.g. `s(...).pan(0) + s(...).pan(1)`
  (using `+` instead of `stack()`/`,` to combine patterns) and
  `.room(0.8).gain(0.5).loop` (`.loop` used as a bare property, not
  called) both correctly evaluate-fail with `pattern.queryArc is not a
  function` — an honest report that the chain no longer produces a
  Pattern, not a bug in the evaluation adapter.
- **[Triage is not the browser]** → A composition that only plays in the
  browser reads as `inconclusive` or `fail` here. Accepted: inconclusive is
  reported separately and never counted as a pass; the mismatch is the same
  one `pattern:check` documents.
- **[Harness and product drift apart]** → The drift-guard test (decision 2)
  fails when `reply.ts` changes model, prompt argument or message shape.
  The Phase 0 seam change must keep it green or update it deliberately.
- **[Overfitting the case set]** → Improving `@jah` against fixed cases can
  make it good at those cases only. Cases test behaviours (names a function,
  fixes an error), not exact strings, and a bug found later gets a new case.
- **[A dirty tree makes a baseline unreproducible]** → The revision records
  `+dirty`; the task for recording the baseline requires a clean tree.
- **[Cost surprises]** → The defaults (about 40 cases × 3 samples) are on the
  order of the existing script's roughly $0.06 for 84 calls; the run prints
  the number of calls it is about to make first.

## Migration Plan

Additive: new files, one `package.json` script, and a mechanical extraction in
`scripts/jah-prompt-eval.mjs`. Nothing deploys differently (scripts are not in
the app bundle) and there is no data change. Rollback is deleting
`scripts/jah-eval/` and reverting the extraction.
