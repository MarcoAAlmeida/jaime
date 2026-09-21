# Phase 2 — `@jah` sees your script

Read [README.md](./README.md) first.

**Goal:** `@jah` knows the whole script in the editor and the part the
asker has highlighted, so it can explain "this part" in context.

**Milestone: `@jah` the explainer** — with Phase 1 this is the first
version worth using day to day.

**Gate:** "what does this do?" and "how does this work?" eval cases (add
them to the Phase 0 set) improve on the Phase 1 result.

Can overlap Phase 1 in practice; it needs Phase 0's reply seam.

---

## Change `add-jah-script-context`

**Why.** Today a mention carries only its own text, and `jah-chat`
requires replies to be stateless. The developer's chief complaint is that
`@jah` "knows nothing of the current script".

**What is sent, and by whom**
- **Whole script:** read **server-side** from the room's document —
  `room.ydoc.getText(DOC_TEXT)` in `server/routes/composition.ts`. No
  client payload, no trust in the client, no size problem on the wire.
- **Selection:** sent by the **asker's client** with the mention: the
  selected text and its range (from/to). The client reads it from
  CodeMirror (`editor.view.state.selection.main` — `editor.view` is
  already used in `app/pages/app/composition/[id].vue`). The editor keeps
  its selection when focus moves to the chat input, so it is still there
  when the message is sent. If the document changed between selecting and
  the server handling the message, prefer the selected *text* and treat
  the range as a hint.
- **Only the asker's own selection.** Other participants' selections are
  ignored, by decision.
- No selection means the model is told the whole script and that nothing
  is highlighted.

**Specs**
- **MODIFIES `jah-chat`**, requirements "Each `@jah` Reply Is Stateless"
  and "Every `@jah`-Addressed Message Is A Discussion Request": a reply
  is still independent of earlier chat messages, but it is generated
  with the room's current script and the asker's selection. Keep the
  scenarios that a follow-up gets no help from an earlier answer.
- **MODIFIES `composition-room`**: the chat client message gains an
  optional selection (`{ t: 'chat', text, selection? }` in
  `shared/compositionProtocol.ts`); the server validates and bounds it and
  ignores it on non-mention messages. Anonymous and viewer messages behave
  as they do today.
- **MODIFIES `frontend-editor`**: the editor wrapper exposes the current
  selection (`app/lib/strudelEditor.ts`).

**Size limits.** Set caps on the script and selection sent to the model
(README Open Decision 4); when the script exceeds the cap, say so to the
model and send the selection plus the nearest lines. Record the added
prompt tokens in `ai_usage`, and revisit the per-user and global daily
caps in `server/jah/caps.ts` if cost per mention rises noticeably.

**UX — discuss first (README Open Decision 6).** The asker should see
that a selection is attached (some indicator near the chat input).
Design it with the developer before building it.

**Prompt.** Update `server/jah/prompt.ts` so the model knows it is given
the script and possibly a selection, and should answer about the selection
while keeping the whole script in mind.

**Tests.** Pool-workers tests in `test/composition.test.ts` /
`test/jah-chat.test.ts`: the model input contains the current document
and the selection; a viewer or non-mention message with a selection is
ignored; oversize selections are bounded; still stateless across
messages. Playwright: selecting text then mentioning `@jah` (canned reply).

**Out of scope.** Errors (Phase 5), memory of earlier exchanges, other
users' selections.
