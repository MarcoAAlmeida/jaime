# Phase 5 — `@jah` the debugger

Read [README.md](./README.md) first.

**Goal:** when a pattern fails to evaluate, `@jah` can say what is wrong,
where, and offer a fix the user can apply in one click.

**Gate:** `fix` eval cases produce code that evaluates at a target rate
set with the developer after the Phase 0 baseline.

Depends on Phases 1–3 (docs for what a function expects and returns, the
code analysis to locate faults, and the script context). Three changes.

## How errors work today (verified)

- Pressing Play sends `{ t: 'eval', atCycle }` to the server, which relays
  it. **The broadcast carries no code and no error.**
- **Every client evaluates its own copy** of the shared document, so every
  client gets the same error for the same text, each as a local
  "Pattern error" alert (`error` ref in
  `app/pages/app/composition/[id].vue`, set from `onError`).
- The server **never sees the error**. The client gets **only
  `err.message`** — no line or column (`app/lib/strudelEditor.ts`).
- A failed evaluation throws before the new pattern is swapped in, so the
  previously running pattern keeps playing. The room's `playing` flag is
  set before the evaluation.
- Typing alone evaluates nothing; errors appear on Play (or on a
  re-evaluate while playing).
- Some problems are not evaluation errors: silence from a missing sound
  happens on the scheduler side.

Because every client sees the same error, **the asker's own error is
representative** of the room's.

---

## Change `add-jah-error-context`

**Why.** The server needs the error text to help.

**Specs**
- **MODIFIES `jah-chat`** and **`composition-room`**: a mention may carry
  the asker's most recent evaluation error message (extend the `chat`
  client message next to Phase 2's selection); the server bounds it and
  passes it to `@jah`. Anonymous and viewer behaviour is unchanged.
- **MODIFIES `frontend-editor`**: the wrapper exposes the last error,
  including scheduler-side errors where available, and clears it when a
  later evaluation succeeds or playback stops.

**UX — discuss first.** How errors surface to `@jah` (automatically with
every mention while an error is showing, or only on request).

**Tests.** The error appears in the model input; a cleared error is not
sent; bounded length.

---

## Change `add-jah-fix-cards`

**Why.** Diagnosis is not enough; the user wants the fix in the editor.

**Specs**
- **MODIFIES the code-cards behaviour** (defined by `add-jah-code-cards`;
  find where it now lives in `openspec/specs/` before editing — likely
  `jah-chat` or `composition-room`): a `@jah` card offers **Apply to
  editor**. It **replaces the entire document** with the card's code and
  **stops playback**. It is offered to **editors only** (hidden for
  viewers, as Preview already is). No targeted patch, no merge.
- **MODIFIES `jah-grounding`**: before a reply that contains code is
  posted, it is **verified**: first the static check (every function
  called exists in the docs index, via `strudel-code-analysis`), then, if
  possible, evaluation. On failure `@jah` repairs and re-checks up to a
  small fixed number of attempts, and says so honestly if it still fails
  rather than posting broken code as fine.
- The fix response should say what was wrong and where (from the
  analysis' position data) in words, then give the card.

**Spike first — `spike-strudel-eval-in-worker`.** Can Strudel's evaluator
run inside a Cloudflare Worker (the room's Durable Object or the Nitro
server)? If yes, verify server-side; if not, the static check runs
server-side and evaluation stays in the browser (Preview already
evaluates client-side). Record the outcome in the change's `design.md`.
This is research, not a spec.

**Model.** This phase may need a stronger model than Llama 3.3 70B; route
it through the AI Gateway and decide from the eval (README Open Decision
5). Keep `ai_usage` and the caps accurate for whichever model is used.

**Tests.** Apply replaces the document and stops playback for an editor,
is absent for a viewer; a reply containing a non-existent function is
repaired or flagged; canned/stubbed model in tests.

**Out of scope.** Writing into the document without a click, patching a
range, undo beyond the editor's own history.
