## Why

Today a `@jah` mention carries only its own text — `@jah` has no idea
what's actually in the room's editor. The developer's chief complaint
about `@jah` so far has been that it "knows nothing of the current
script," so it can't answer "what does this do?" or explain a
highlighted line in context. This is Phase 2 of the `@jah` intelligence
roadmap (`docs/04-roadmap/jah-intelligence/phase-2-sees-your-script.md`)
and, combined with Phase 1's grounding, is the first version of `@jah`
meant to be useful day to day.

## What Changes

- A `@jah` mention is answered with the room's **current script**
  (read server-side from `room.ydoc.getText(DOC_TEXT)` — never trusted
  from the client) and, when the asker has one, **their own text
  selection**, sent by their client with the mention.
- The chat client message gains an optional selection: `{ t: 'chat',
  text, selection? }`. The server validates and bounds it, and ignores
  it entirely for non-mention messages and for anonymous/viewer senders
  who can't reach `@jah` anyway.
- The editor wrapper (`app/lib/strudelEditor.ts`) exposes the current
  selection so the chat UI can read it when a message is sent.
- The chat input shows a small label when a selection is attached (e.g.
  "N lines selected"), so the asker knows what `@jah` will see —
  confirmed UX approach, a plain label next to the input rather than a
  richer preview.
- Both the script and the selection are capped in size; an oversized
  script is truncated with the selection (plus its nearest lines) kept
  intact, and `@jah` is told the script was truncated rather than
  silently given a partial one. Added prompt tokens are recorded in
  `ai_usage`.
- `@jah`'s system prompt is updated so it knows it may be given the
  script and a selection, and answers about the selection while keeping
  the whole script in mind.
- `@jah` replies remain stateless across messages: this context is
  read fresh for every mention, never accumulated from earlier ones.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `jah-chat`: requirements "Each `@jah` Reply Is Stateless" and "Every
  `@jah`-Addressed Message Is A Discussion Request" — a reply is still
  independent of earlier chat messages, but is now generated with the
  room's current script and the asker's own selection, when they have
  one.
- `composition-room`: the chat client message gains an optional
  selection; the server validates, bounds, and scopes it (ignored for
  non-mention messages and for senders who can't reach `@jah`).
- `frontend-editor`: the editor wrapper exposes the current selection
  for the chat UI to read.

## Impact

- `server/routes/composition.ts` — `handleJahMention` reads
  `room.ydoc.getText(DOC_TEXT)` and the incoming selection, passes both
  to reply generation.
- `server/jah/reply.ts` / `server/jah/prompt.ts` — the model call and
  system prompt gain script/selection context, alongside Phase 1's
  retrieved knowledge context.
- `shared/compositionProtocol.ts` — `ChatMessage`'s client-sent shape
  gains an optional `selection`.
- `app/lib/strudelEditor.ts` — exposes the current selection from the
  wrapped CodeMirror `EditorView`.
- `app/pages/app/composition/[id].vue` — reads the selection when
  sending a chat message; shows the "selection attached" label.
- `server/auth/aiUsage.ts` / `migrations/patterns/` — a new migration
  for the added prompt-token accounting, following the same pattern as
  Phase 1's `retrieval_chunks_used`/`embedding_tokens` columns.
- `server/jah/caps.ts` — revisited only if the added prompt size makes
  per-mention cost rise enough to matter (not a guaranteed change).
