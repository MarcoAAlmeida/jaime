## 1. Prompt

- [x] 1.1 `server/jah/prompt.ts`: add the "Examples" section (design
      decision 1) to `JAH_SYSTEM_PROMPT`.
- [x] 1.2 `server/jah/reply.ts`: the `JAH_E2E` canned reply becomes a short
      prose line (still matching `/canned/i`) plus a fenced `strudel`
      block.
- [x] 1.3 Unit test that the assembled prompt carries the fence
      instruction and the clean-breaks pointer, and that the canned reply
      still matches `/canned/i` and contains a fenced block.
- [x] 1.4 `scripts/jah-prompt-eval.mjs`: the ad-hoc harness (real prompt
      file, real model via wrangler's remote AI binding, question list,
      per-variant table: fenced / labelled+complete / unloaded sound /
      invented pack), with a header comment saying how to run it and
      what it costs.

## 2. Splitting replies

- [x] 2.1 `app/lib/chatMarkdown.ts`: export a parse-only tokeniser over
      the existing `markdown-it` instance (no rendering path changes).
- [x] 2.2 `app/lib/chatSegments.ts`: `splitReply` per design decision 2
      (top-level fences only; strudel/js/javascript/empty accepted;
      stray first-line label dropped; other languages stay text; empty
      blocks dropped).
- [x] 2.3 Unit tests: prose + fence; two fences with text between (order
      kept); no fence (one text segment); unlabelled, `js`, and
      label-on-next-line fences; `python` stays text; fence in a list
      stays text; empty fence; text segments are the original Markdown;
      hostile text in a fence stays inert data.

## 3. Shared card and preview

- [x] 3.1 `app/composables/usePatternPreview.ts`: extract the preview state
      machine from `patterns.vue` (with `beforeStart`, `maxMs`), keeping
      the library's behaviour identical.
- [x] 3.2 `app/components/StrudelCard.vue`: code block, Preview, Copy code,
      Open in strudel.cc, an extra-actions slot, `canPreview`, error
      display; testids `strudel-card`, `card-preview`, `card-copy`,
      `card-open`.
- [x] 3.3 `patterns.vue` uses both; Load into JAM / Composition Room move
      into the slot. Existing library e2e (`pattern-loading`,
      `pattern-playback`) stay green.

## 4. Cards in the chat

- [x] 4.1 `[id].vue`: for `@jah` messages render `splitReply` segments —
      text through `ChatMarkdown`, code through `StrudelCard`; human
      messages unchanged; keep `chat-message` on the message wrapper.
- [x] 4.2 Preview wiring per design decision 4: `beforeStart` broadcasts
      Stop when the room is playing; `maxMs: 5000` started after
      evaluation resolves; a room `eval` and page unmount end a preview;
      `canPreview` is `isEditor` only.
- [x] 4.3 Check phone width: card actions wrap, code scrolls
      horizontally, no horizontal page scroll.

## 5. Tests, verify, ship

- [x] 5.1 `e2e/jah-cards.spec.ts` (canned reply): an allowlisted user's
      `@jah` reply shows a card with Preview / Copy / Open; a human's
      fence does not; no Load into JAM/Composition on the card; Copy puts
      exactly the code on the clipboard; Open points at strudel.cc with
      that code; a viewer (`?role=viewer`) sees Copy and Open but no
      Preview; with the room playing, Preview stops it for a second
      participant, and after ~5 s the preview ends and the room is still
      stopped; Play during a preview ends the preview.
- [x] 5.2 Typecheck, `vitest run`, `playwright test` green (including
      `pattern-playback`, `pattern-loading`, `jah-chat`, `chat-interface`,
      `composition`). Rebuild before pool-workers tests.
- [x] 5.3 Run `scripts/jah-prompt-eval.mjs` against the final prompt and
      record the numbers in design.md.
- [x] 5.4 `openspec validate add-jah-code-cards --strict`.
- [ ] 5.5 Browser-verify locally (desktop + phone), then `npm run deploy`
      and confirm on jaime.stream with a real `@jah` question: the reply
      shows a card, Preview pauses the room and plays ≤ 5 s, Copy and
      Open work.
- [ ] 5.6 Sync the `jah-chat` and `composition-room` deltas; archive.
