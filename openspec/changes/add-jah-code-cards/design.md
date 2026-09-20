## Context

`@jah` is a stateless, single-prompt assistant: `server/jah/reply.ts`
sends the AI SDK's `generateText` a `system` prompt
(`server/jah/prompt.ts`: identity + house style + a hand-written Strudel
cheatsheet) and one user message (whatever followed `@jah`). No room
history, no document. The model is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
via Workers AI and the `jaime-jah` gateway. The reply is plain text; the
chat renders every message as safe Markdown (`app/lib/chatMarkdown.ts`),
so a fenced block is today just a grey code block.

The Pattern Library page (`app/pages/app/patterns.vue`) already has the
target affordance — an expanded card with the code, Preview, Copy code,
Open in strudel.cc, and (library-only) Load into JAM / Composition Room —
with its preview logic inline in the page.

The user chose to go with the single-prompt approach ("option A") now and
to move to a fuller orchestration (retrieval, skills, agents) later; this
change is deliberately naive, tolerant of misfires, and cheap to replace.

## Goals / Non-Goals

**Goals**

- `@jah` replies carry a playable example whenever it suggests code, shown
  as a card with Preview / Copy / Open in strudel.cc.
- Previewing must not leave anyone out of sync with the room.
- One card component shared with the Pattern Library.
- Measure the prompt against the real model before committing to it, and
  keep the means to re-measure.

**Non-Goals**

- Any change to `@jah` gating, caps, kill switch, statelessness.
- Cards on human messages; a "use in room" action that edits the document.
- Guaranteeing the model's formatting (the client tolerates slips instead).
- The orchestration framework that will later replace the single prompt.

## Decisions

### 1. Prompt: the user's one line, plus one correct pack pointer

Appended to the system prompt as its own short section:

> Examples: a playing example is always welcome. For any snippet you
> suggest, show a short pattern that plays it, in a fenced block labelled
> strudel. Breakbeats such as "amen" aren't loaded by default — for those,
> put `samples('github:yaxu/clean-breaks/main')` as the first line of the
> block. Never invent a sample pack or a github repo name.

Measured before deciding (ad-hoc harness: the real prompt file, the same
`generateText` call, 12–16 realistic questions incl. "amen" and "jungle
breakbeat", 2–3 samples each; about $0.06 in total):

| Prompt | Has a fence | Labelled `strudel` + complete | Silent (sound not loaded) |
| --- | --- | --- | --- |
| Current | 0% | 0% | – |
| + the one line | 100% | 96% | 8% (all `s("amen…")`) |
| + fuller rules ("only fence complete patterns", "load packs as needed") | 92% | 75% | 0% |
| + one line + the exact pack pointer | 100% | 81% (see below) | 0% |

Every "miss" in the last row was correct code with the label on the line
*after* the fence (decision 2) — the tolerant reader recovers them.

Re-measured on the final prompt with the kept harness
(`node scripts/jah-prompt-eval.mjs --variants final --samples 3`, 14
questions x 3 samples = 42 real replies, 2026-09-20): a fence in 100%,
labelled `strudel` and complete in 86%, recoverable by the tolerant reader
in 100%, one silent reply (2%, a break used without loading it), and no
invented packs (0%).

The fuller rules were rejected: they made the model skip the example for
simple questions (`.fast`), and told to "load whatever pack is needed" it
invented `github:electronica/breakbeats`. A *specific* pointer works; a
general instruction hallucinates. The pointer duplicates knowledge of
which sounds are loaded, which will not scale — retrieval is the later
fix, not a longer prompt.

The `samples(...)` line stays in the block rather than preloading
clean-breaks for everyone: the card offers Open in strudel.cc, and code
that only works because our room preloaded a pack would be silent there.

The harness is kept as `scripts/jah-prompt-eval.mjs` so any later prompt
change is measured the same way (needs `wrangler login`; costs cents).

### 2. Splitting a reply into text and code

`app/lib/chatSegments.ts`, pure: `splitReply(text)` returns a list of
`{ kind: 'text', text }` and `{ kind: 'code', code }` segments. It
tokenises with the same `markdown-it` instance the chat already trusts
(parse only — no rendering), takes **top-level** fence tokens, and slices
the *source* by each fence's line range so the text segments are the
original Markdown (then rendered by `ChatMarkdown` as today). Fences
nested in lists or quotes stay inside their text. A fence is Strudel if
its info string is `strudel`, `js`, `javascript` or empty; another
language stays in the text as an ordinary code block. Normalisation: if
the first line inside the fence is exactly `strudel`/`js`/`javascript`
(the observed model slip), drop it. Empty code produces no card. Unclosed
fences behave as `markdown-it` does (run to the end).

Only `@jah` messages are split (the mapping already marks them
`metadata.jah`); a human's message keeps going straight to `ChatMarkdown`.
The card shows code as text (never `v-html`), so a prompt-injected reply
cannot render markup.

### 3. One card component, one preview composable

- `app/components/StrudelCard.vue`: the code block plus **Preview**,
  **Copy code**, **Open in strudel.cc**, and a slot for extra actions
  (the library fills it with Load into JAM / Composition Room; chat leaves
  it empty). Props: `code`, `canPreview`, `previewing`, `previewLoading`,
  `error`; event: `preview`. Copy and Open (`toStrudelUrl`) live inside.
- `app/composables/usePatternPreview.ts`: the preview state machine
  extracted from `patterns.vue` — `previewingId`, `loading`, `error`,
  `toggle(id, code)`, `stop()` — over the existing `audioEngine`
  singleton, with two options: `beforeStart` (awaited before playing) and
  `maxMs` (auto-stop). The library uses it unchanged (no options). Because
  the repl is a module singleton, "one preview at a time" is inherent,
  across the library and chat alike.

Alternative rejected: copying the library's card markup into the chat —
two cards that drift.

### 4. Preview pauses the room for everyone

Per the user: stopping only the previewer leaves them out of sync with
their mates, so the pause is room-wide. In the room, `beforeStart` is
"if the room is playing, broadcast Stop and wait for it to land" — the
existing `requestStop` path (every participant's editor stops via the
`stop` message). Then the preview repl evaluates the card's code and plays
for the previewer only; a 5 s timer, started once evaluation has
resolved (so a pack download doesn't eat the window), stops it. Nothing
restarts the room. A room `eval` (someone presses Play) ends any running
preview so two sounds never overlap; leaving the page stops it. Preview is
offered only to editors (`role === 'editor'`; the client already gates
Stop this way).

Not built: auto-resuming the room after the preview. The user accepted
"someone presses Play"; resuming would need a leader election and is the
kind of thing that surprises people.

### 5. Trust

Strudel code is JavaScript, so Preview evaluates arbitrary code in the
previewer's page. This does not open a new class of exposure: every room
joiner is an editor who can already put code in the shared document that
runs in every participant's page on Play. What keeps it in check here is
that `@jah` only answers allowlisted accounts, nothing evaluates on
render (cards are text until someone clicks Preview), and the click is
explicit. Recorded so the orchestration-era design revisits it.

### 6. Testing the untestable

`JAH_E2E` stubs the model, so e2e cannot exercise the prompt. The stub's
canned reply gains a short prose line and a fenced `strudel` block
(existing tests match `/canned/i`, which still holds), so cards, Preview,
Copy and the room-wide pause are covered end to end without spending
tokens. Prompt *behaviour* is covered by the eval harness, run by hand.

## Risks / Trade-offs

- **[Model doesn't fence / mislabels]** → about 4% observed; the reply
  shows as text or a plain code block. Accepted (user: "we can deal with
  occasional misfires now").
- **[Model writes a fragment in a fence]** → Preview shows a pattern error
  on the card. Accepted.
- **[Model invents a function or sound]** → error, or (for sounds)
  silence — the eval harness counts unloaded sounds so drift is visible.
- **[First beat of a pack-loading pattern may be silent]** → carried over
  from the library: `samples()` in code loads asynchronously. Accepted.
- **[Prompt rots as sound banks change]** → the pack pointer is a
  hand-maintained fact; the eval harness catches breakage, retrieval
  replaces it later.
- **[Model swap changes formatting]** → re-run the harness.

## Migration Plan

No data or schema change. Deploy is ordinary. Rollback is redeploying the
previous version; without the prompt line `@jah` simply stops producing
fences and the chat renders its code as plain code blocks, as today.
