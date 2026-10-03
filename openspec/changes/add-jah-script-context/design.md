## Context

See `proposal.md` for motivation; `docs/04-roadmap/jah-intelligence/phase-2-sees-your-script.md` for the roadmap framing this change implements.

**What already exists, verified in code:**
- `handleJahMention` (`server/routes/composition.ts`) builds one user
  message from `mention.rest`, calls `retrieveContext` (Phase 1,
  `jah-grounding`) for corpus-grounded context blocks, then
  `generateJahReply(env, messages, contextBlocks)`, which calls
  `buildSystemPrompt(contextBlocks)`.
- `room.ydoc.getText(DOC_TEXT)` is already how the server reads the
  shared script elsewhere in `composition.ts` — no new access pattern
  needed.
- `StrudelEditor.view` (`app/lib/strudelEditor.ts`) already exposes the
  raw CodeMirror `EditorView` publicly. `view.state.selection.main` and
  `view.state.sliceDoc(from, to)` are standard CodeMirror APIs backed by
  the editor's own state, unaffected by DOM focus.
- The client→server chat message today is `{ t: 'chat', text: string }`
  (`shared/compositionProtocol.ts`).
- `buildSystemPrompt(contextBlocks: string[] = [])` (Phase 1) is
  byte-identical to `JAH_SYSTEM_PROMPT` with no context blocks — the
  guarantee every phase since Phase 0 has preserved.

## Goals / Non-Goals

**Goals:**
- The room's current script, and the asker's own selection when they
  have one, reach every `@jah` reply, read fresh each time.
- Both are bounded in size, with a truthful notice to the model when
  the script had to be trimmed.
- A selection never reaches anyone but the asker's own reply, and never
  reaches a sender who couldn't get a reply anyway.
- The asker sees a plain label confirming a selection is attached.
- Every existing statelessness/byte-identical guarantee still holds
  with no script and no selection.

**Non-Goals:**
- Re-anchoring a selection whose range no longer matches the document
  (decision 1 sidesteps needing this at all).
- Changing `server/jah/caps.ts`'s daily limits pre-emptively — only if
  a real cost increase warrants it (roadmap Open Decision 4).
- Any memory of an earlier message's script or selection.
- Errors, evaluation state, or anything from Phase 5.

## Decisions

### 1. Wire shape carries selection *text* only, not a range

```ts
selection?: { text: string }
```

The roadmap brief mentions sending the range too, as a "hint" for when
the document changed between selecting and the server handling the
message — but every concrete behavior it describes explicitly "prefers
the text" regardless. No scenario in this phase reads a range. Sending
one anyway would be a field with no reader on either end. Kept minimal;
additive later if a phase that needs positional anchoring (e.g. a
debugger jumping to a location) arrives.

### 2. `buildSystemPrompt` gains a separate, typed script-context parameter

```ts
export interface ScriptContext { script: string, selection?: string, truncated: boolean }
export function buildSystemPrompt(contextBlocks: string[] = [], scriptContext?: ScriptContext): string
```

Not folded into `contextBlocks: string[]`. That array's framing
("reference material — use this to ground your answer") fits Phase 1's
retrieved knowledge; the room's own live script isn't "reference
material" in that sense, and the truncation notice needs its own
wording. Keeping them separate also keeps the zero-arg byte-identical
guarantee trivial to reason about — both parameters default to
producing exactly today's prompt — and leaves Phase 1's own
`contextBlocks` tests untouched.

### 3. Script/selection are read and bounded server-side, alongside retrieval

In `handleJahMention`, next to the existing `retrieveContext` call —
the script is never trusted from the client; the client-supplied
selection is bounded here too, before a reply is generated. A small,
directly-testable pure function (`server/jah/scriptContext.ts`, mirroring
`retrieval.ts`'s shape) — `buildScriptContext(fullScript, selectionText,
limits) → ScriptContext` — does the bounding; `handleJahMention` stays
the orchestration seam, same pattern Phase 1 established.

### 4. Size caps: `MAX_SCRIPT_CHARS = 4000`, `MAX_SELECTION_CHARS = 2000`

Small, deliberate, tunable constants — same rationale as Phase 1's
`SEMANTIC_TOP_K`/`MAX_CONTEXT_CHUNKS`. When the full script exceeds
`MAX_SCRIPT_CHARS`: with a selection, send the selection plus script
content nearest to it (split roughly evenly before/after, bounded by
the same cap) instead of the full script; with no selection, send the
first `MAX_SCRIPT_CHARS` characters. Either way `truncated: true` drives
the prompt telling `@jah` plainly the full script didn't fit — matching
the jah-chat spec's own scenario.

### 5. Selection scoping is structural, not an extra filter

`handleJahMention` only ever runs for a message that has already passed
every existing decline check (access, caps, kill switch) — a sender who
can't reach `@jah` never reaches this code, so "selection ignored for
someone who can't reach @jah" is free. A selection on a non-mention
message is scoped the same way: `postChatMessage`'s own path for an
ordinary human message never reads `msg.selection` at all — the field
exists on the wire type, but nothing on that path looks at it, so it
can't leak into anyone else's view by construction, not by a
special-cased filter.

### 6. No new method on `StrudelEditor` for reading the selection

`view` (already public) plus standard CodeMirror (`view.state.selection.main`,
`view.state.sliceDoc(from, to)`) already satisfy "read the current
selection at any time, focused or not" — CodeMirror's selection lives in
editor state, independent of DOM focus. The ADDED `frontend-editor`
requirement documents this as a now-governed capability; no code change
is needed there to satisfy it on its own. The only new code on the
editor side is decision 7's reactivity for the label.

### 7. The "selection attached" label is driven by one new editor callback

`StrudelEditorOptions` gains `onSelectionChange?: (hasSelection: boolean) => void`,
fired from the *existing* `updateListener` (already used for
`onCodeChange`) extended to also check `u.selectionSet` — same
mechanism, same call site, one more condition, not a new subsystem.
Composition Room keeps a `hasSelection` ref updated by this callback and
shows a plain label next to the chat input when true (confirmed UX: a
plain label, not a richer preview — exact copy is an implementation
detail, not a spec concern).

### 8. `ai_usage` gains one column: `script_chars_sent`

`migrations/patterns/0012_ai_usage_script_context.sql` adds
`script_chars_sent INTEGER NOT NULL DEFAULT 0` — the character count
actually included in a reply's context (`0` for `JAH_E2E`, or a mention
where nothing was included). One column, not separate script/selection
sub-metrics — matches Phase 1's "one column per whole added concern"
precedent (`retrieval_chunks_used`), not granular metrics nothing yet
consumes.

## Risks / Trade-offs

- **[Bigger prompts raise per-mention cost]** → Small, deliberate caps
  (decision 4); `script_chars_sent` gives a later look real data to
  decide whether `server/jah/caps.ts`'s daily limits need revisiting —
  not changed pre-emptively, per the roadmap's own Open Decision 4.
- **[A selection's text can go stale relative to a since-edited
  document]** → Accepted directly by decision 1's text-only shape,
  matching the roadmap's own explicit choice to prefer text over trying
  to re-resolve a range.
- **[One more editor callback]** → Mirrors the existing `onCodeChange`
  wiring exactly (decision 7); no new subsystem, no new lifecycle to
  manage.

## Migration Plan

Additive throughout: a new optional wire field, a new optional editor
callback, a new migration, extended function signatures with defaults
that reproduce today's exact behavior when the new arguments are
omitted (`buildSystemPrompt(contextBlocks)` still works; script context
is simply absent). Rollback: stop calling the new script-context
builder in `handleJahMention` (reverts to Phase 1's exact behavior); the
new migration's unused column can be left in place harmlessly.

## Open Questions

- Exact label copy and placement — decision 7 fixes the mechanism; the
  wording itself isn't spec-governed and can be adjusted freely without
  touching this change's contract.
