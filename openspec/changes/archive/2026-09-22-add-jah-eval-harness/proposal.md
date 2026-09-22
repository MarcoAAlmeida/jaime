## Why

`@jah` is a placeholder: every reply comes from one static prompt and the
mention's own text, and the developer's verdict is that it answers "dumbly",
makes mistakes about Strudel and knows nothing of the script. The roadmap
(`docs/04-roadmap/jah-intelligence/`) plans six phases to fix that, and each
one must beat a number — but there is no number. The one existing
measurement, `scripts/jah-prompt-eval.mjs`, compares prompt *variants* on
formatting only (is there a fence, is it labelled, does it use an unloaded
sound); it cannot say whether an answer is *right* or whether the code it
gives even runs.

Without a baseline taken before anything changes, every later improvement is
an opinion. Phase 0 exists to take that baseline.

## What Changes

- **A committed case set** in three kinds: `docs` (a question about Strudel),
  `fix` (broken code plus the error a user would see) and `compose` (a
  request to write something). About 40 cases to begin with, in a documented,
  human-readable format.
- **A run command** (`npm run jah:eval`) that sends every case through
  `@jah`'s model with `@jah`'s system prompt, several samples per case,
  and prints and saves a report. It needs the developer's Workers AI access
  and spends real (tiny) money, so it is **not** part of `npm test` or CI.
- **Scoring that needs no model**, so it can be unit-tested with fixture
  replies. Code is judged by *evaluating it* with the same headless
  evaluator `pattern:check --fast` uses (`createTriage`); a pattern that
  produces no events is *inconclusive*, never a pass. Each kind adds its own
  checks (expected functions named; the fix evaluates and actually changed;
  the composition evaluates and honours its constraints).
- **A "does every function used exist?" check that is reported as
  unavailable** until Phase 1 builds the docs index — visible in the report,
  never silently skipped.
- **A committed baseline** of today's `@jah`, and a `--compare` mode so a
  later run prints its differences against it.
- **A case-set validator** (`--validate`) that confirms every `fix` case's
  broken code really fails, so a case cannot quietly become meaningless.
- **The existing prompt-variant script keeps working**; the reply-parsing
  helpers it and the new harness both need move to one shared module.

No product behaviour changes: no server, client, protocol, database or
prompt change.

## Capabilities

### New Capabilities
- `jah-eval`: the developer workflow that measures `@jah` — the case set and
  its kinds, running it against `@jah`'s model, model-free scoring with code
  judged by evaluation, the report, the committed baseline and comparison,
  and the rule that it spends money only when asked.

### Modified Capabilities
<!-- None: no existing requirement changes. `jah-chat` describes what @jah
     does for users; this change measures it and does not alter it. -->

## Impact

- **New code:** `scripts/jah-eval/` (run command, case loader and validator,
  scoring, report/compare, shared reply helpers), the case files, the
  committed baseline, and their tests under `npm run test:scripts`.
- **Touched:** `package.json` (a `jah:eval` script);
  `scripts/jah-prompt-eval.mjs` (imports the shared helpers instead of
  carrying its own copies — behaviour unchanged).
- **Reuses, unchanged:** `scripts/patterns/lib/triage.mjs` (`createTriage`),
  `scripts/jah-prompt-eval.wrangler.jsonc` (the AI-only remote binding),
  `server/jah/prompt.ts` (the system prompt).
- **Dependencies:** none new.
- **Cost:** a run is a few cents of Workers AI usage; a run is never
  triggered by CI or `npm test`.
- **Later phases** depend on this: every one of them is gated on the eval
  result recorded here.
