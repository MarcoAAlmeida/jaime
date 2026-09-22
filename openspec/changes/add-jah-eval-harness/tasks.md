## 1. Shared reply helpers and scaffolding

- [x] 1.1 `scripts/jah-eval/lib/replies.mjs`: move `fences`, `balanced`, the
      `REAL_PACKS` / `UNLOADED_SOUNDS` constants and the formatting `score`
      out of `scripts/jah-prompt-eval.mjs` unchanged, and add
      `primaryBlock(reply)` (first `strudel`-labelled fence, else the first
      fence the chat accepts — `js`/`javascript`/unlabelled, or the label on
      the following line, stripped). Tests pin every helper's output on
      fixture replies, including an unterminated fence and a label on the
      next line.
- [x] 1.2 `scripts/jah-prompt-eval.mjs` imports the helpers instead of
      carrying copies; behaviour and printed output are unchanged
      (`node --check`, and the pinned helper tests from 1.1).
- [x] 1.3 `package.json`: add `"jah:eval": "node scripts/jah-eval/run.mjs"`.
- [x] 1.4 `scripts/jah-eval/README.md`: what the harness is, the case format
      (fields per kind, how a fix case's message is assembled), every
      command and flag, where reports and the baseline live, how to add a
      case, and that a run spends real money and needs `npx wrangler login`.

## 2. The case set: loading, validation, rendering

- [x] 2.1 `lib/cases.mjs`: load `cases/*.mjs`, validate the whole set and
      report *every* problem (missing required fields per kind, unknown
      kind, non-kebab or duplicate ids, empty `expect`), fingerprint the set
      (sha-256 of the cases normalised and sorted by id). Tests for each
      failure and for a valid set.
- [x] 2.2 Message rendering: docs and compose send `message`; fix sends
      `message` (default "This won't run — can you fix it?") plus the error
      and the broken code in a `strudel` fence. Tests.

## 3. Scoring (pure, no model, no network)

- [x] 3.1 `lib/functions.mjs`: `loadFunctionIndex()` returning
      `{ available: false, reason }` today. Test that scoring records the
      check as unavailable — neither pass nor fail — and lists it in the
      report's `unavailable`.
- [x] 3.2 `lib/score.mjs`: `score(case, reply, evalOutcome)` → per-check
      results and a sample verdict (`pass` / `fail` / `inconclusive`), with
      the per-kind checks of the spec: docs (expected names as whole words,
      forbidden names, code required when the case says so), fix (evaluates,
      differs from `broken`, every `keep` fragment present), compose
      (evaluates, `mustUse`, `mustNotUse`, `minEvents`), plus the formatting
      measures for every reply. Tests on recorded replies with fake
      evaluation outcomes cover every scenario in `specs/jah-eval/spec.md`,
      including: unchanged fix fails, fix missing a `keep` fragment names it,
      docs missing a function names it, inconclusive is not a pass, no code
      where code is required fails, an unloaded sound fails with its name,
      and scoring the same input twice gives identical output.
- [x] 3.3 Evaluation adapter: evaluate the reply's primary block with
      `createTriage().check` (from `scripts/patterns/lib/triage.mjs`), map its
      statuses to `pass` / `fail` (error or missing sounds, with the error or
      the sound names) / `inconclusive` / `no code`, one block at a time
      (triage mutates `globalThis.samples`). Tests with a fake triage.

## 4. The model call

- [x] 4.1 `lib/model.mjs`: `generateText` with the model id and
      `JAH_SYSTEM_PROMPT` (imported from `server/jah/prompt.ts`) and the
      message as the single user message, through the remote AI binding from
      `getPlatformProxy` and `scripts/jah-prompt-eval.wrangler.jsonc`, no AI
      Gateway. Four calls at a time; a failed call becomes an `error` sample
      with the reason and the run continues. If the binding is unavailable,
      say so plainly and exit before any call. Tests use an injected fake
      model function.
- [x] 4.2 Drift-guard test: reads `server/jah/reply.ts` as text and asserts
      it uses the same model id literal as `lib/model.mjs`, passes
      `JAH_SYSTEM_PROMPT` as `system`, and sends the mention text as one user
      message (the pattern `triage.test.mjs` uses for the sound banks).

## 5. Report, baseline, comparison, command

- [x] 5.1 `lib/report.mjs`: prompt fingerprint (short sha-256 of the system
      prompt), revision (`git rev-parse --short HEAD`, `+dirty` when the tree
      has changes), the report object, and the printed summary (per-kind and
      overall sample counts of pass / fail / inconclusive / error, pass rate,
      unavailable checks with reasons, each case with a failing sample and
      its failing check). Tests.
- [x] 5.2 Baseline and comparison: `--save-baseline` writes
      `scripts/jah-eval/baseline.json` (report without reply texts and code
      blocks) and nothing else does; `--compare` prints the pass-rate change
      per kind and overall, the cases whose pass rate moved (before → after),
      a plain statement of what differs (model, prompt fingerprint, case-set
      fingerprint, sample count), and lists cases present in only one run
      without counting them. Tests for a rise, a fall, a new case, differing
      prompts, and that a plain run never touches the baseline.
- [x] 5.3 `run.mjs`: flags `--samples N` (default 3), `--kinds`, `--case <id>`,
      `--out <file>` (default: a timestamped file in the OS temp directory),
      `--save-baseline`, `--compare`, `--validate`. Before any model call:
      validate the case set (refuse on any problem) and print how many calls
      will be made. A default run writes nothing inside the repository.
- [x] 5.4 `--validate`: structural checks, then evaluate every fix case's
      broken code and require an error or missing sounds; report each invalid
      case and exit non-zero; print the evaluator's actual error beside the
      stated one. Tests with a fake triage.

## 6. The case set itself (reviewed by the developer)

- [x] 6.1 Author about 20 `docs` cases: the 14 questions from
      `scripts/jah-prompt-eval.mjs` (with the function names a correct answer
      names) plus others covering effects, time and structure functions,
      mini-notation and samples.
- [x] 6.2 Author about 10 `fix` cases from realistic mistakes (an undefined
      function, a misspelt function, a bad mini-notation string, a missing
      closing bracket, an unloaded sound, wrong argument shape). Run
      `--validate`; set each case's `error` to the message the evaluator
      really produces; add `keep` fragments where a fix must not discard the
      rest.
- [x] 6.3 Author about 10 `compose` cases with mechanically checkable
      constraints (`mustUse`, `mustNotUse`, `minEvents`).
- [x] 6.4 The developer reviews the case set — like a pattern review, before
      anything is measured against it. Cases the developer drops or changes
      are applied.

## 7. Baseline and verification

- [x] 7.1 With a clean working tree and after `npx wrangler login`: run the
      full set twice, record the spread between the two runs and the
      resulting numbers in `design.md`, then `--save-baseline` and commit
      `scripts/jah-eval/baseline.json`.
- [x] 7.2 `npm run test:scripts` passes and includes every new test with no
      network and no model; `npm test` and `npm run typecheck` are green.
- [x] 7.3 `openspec validate add-jah-eval-harness --strict`.
- [ ] 7.4 After the developer's review: sync the `jah-eval` spec into
      `openspec/specs/` and archive.
