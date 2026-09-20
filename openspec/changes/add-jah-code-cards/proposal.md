## Why

`@jah` answers Strudel questions in chat, but its code arrives as prose
with inline backticks — nothing to run, nothing to take away. A reply that
teaches `.fast(2)` is most useful when it comes with a pattern you can
hear, copy, or open in strudel.cc. The Pattern Library already has
exactly that affordance (an expanded card: the code, a preview, copy,
open-in-strudel.cc); `@jah`'s replies should offer the same.

## What Changes

- **`@jah` is told a playing example is always welcome.** Its system
  prompt gains a short instruction: for any snippet it suggests, show a
  short pattern that plays, in a fenced block labelled `strudel`; and
  breakbeats such as `amen` aren't loaded by default, so a block that uses
  them starts with `samples('github:yaxu/clean-breaks/main')`, and it must
  never invent a sample pack. (Measured against the real model before
  writing this — see design.md — the plain instruction alone yields a
  labelled, runnable block in 96% of replies; the current prompt yields
  none.)
- **`@jah`'s fenced Strudel code is shown as a card** in the Composition
  Room chat: the code, plus **Preview**, **Copy code** and **Open in
  strudel.cc**. Only `@jah`'s replies get cards; a person's fenced code
  stays an ordinary code block. Text around the code renders as before.
- **Previewing a card is a room-wide pause.** Clicking Preview stops the
  room's playback for everyone (so nobody drifts out of sync with the
  room), plays the snippet for the previewer alone for at most 5 seconds,
  then goes silent. The room stays stopped until someone presses Play.
  Viewers don't see Preview.
- **The Pattern Library card becomes a shared component**, reused for
  chat. The library keeps its extra actions (Load into JAM, Load into
  Composition Room); the chat card shows none of them.
- **A tolerant reader for model formatting.** The model sometimes puts the
  label on the line after the fence, or omits it; the chat accepts
  `strudel`, `js`, `javascript` and unlabelled fences as Strudel and
  strips a stray leading `strudel` line. Occasional misfires (a reply with
  no fence at all) are accepted: the reply simply shows as text.

Out of scope, deliberately: any change to `@jah`'s gating, caps, or
statelessness; putting cards on human messages; a "use in room" action
that writes into the shared document; and the fuller orchestration
(retrieval, skills, agents) that will eventually replace this
single-prompt approach.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `jah-chat`: `@jah` is told to include a playing example, in a labelled
  fence, and how to handle non-default sample packs.
- `composition-room`: `@jah`'s Strudel code renders as a card with Preview
  / Copy / Open in strudel.cc; Preview pauses the room for everyone for at
  most 5 seconds and is hidden from viewers.

## Impact

- `server/jah/prompt.ts` (instruction text), `server/jah/reply.ts`
  (canned E2E reply gains a fenced block so cards are testable).
- `app/lib/chatSegments.ts` (new, pure): splits a reply into text and code
  segments and normalises fences.
- `app/components/StrudelCard.vue` (new, extracted from
  `app/pages/app/patterns.vue`), used by the library and the chat.
- `app/pages/app/composition/[id].vue`: cards in the chat log; Preview
  wiring (room stop, 5s timer, viewer gating).
- `app/lib/audioEngine.ts` is reused as is (the shared preview repl).
- Tests: unit tests for segmenting; an e2e spec for cards and the
  room-wide pause; existing library and `@jah` e2e must still pass.
- No protocol, schema, or migration change. Deploy is ordinary.
