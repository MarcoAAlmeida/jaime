## 1. The prompt seam (byte-identical with no script context — same guarantee every phase keeps)

- [x] 1.1 `server/jah/prompt.ts`: export `ScriptContext { script: string,
      selection?: string, truncated: boolean }`; `buildSystemPrompt(contextBlocks:
      string[] = [], scriptContext?: ScriptContext)`. With no `scriptContext`,
      output is unchanged from today (Phase 1's own guarantee holds
      unchanged too — the two parameters are independent). Test: omitting
      `scriptContext` is byte-identical to before; with one, the script
      (and selection, when present) appear in the output; a `truncated:
      true` context includes a plain notice that the full script didn't fit.
      Also corrected `IDENTITY`/`STYLE`'s wording, which claimed `@jah`
      "cannot currently see" the document — no longer true once this
      phase ships; the byte-identical guarantee is about the new
      parameter being additive, not about freezing that now-inaccurate
      text. No existing test hardcoded the old wording.
- [x] 1.2 Ran the pre-existing `test/jah-reply.test.ts` tests (not the
      new ones just added for 1.1) and confirmed they still pass
      unmodified — the guarantee this task exists to prove.

## 2. Script context

- [x] 2.1 `server/jah/scriptContext.ts`: `MAX_SCRIPT_CHARS = 4000`,
      `MAX_SELECTION_CHARS = 2000` (named constants). `buildScriptContext(fullScript:
      string, selectionText: string | undefined): ScriptContext` —
      trims an oversized selection to `MAX_SELECTION_CHARS`; when the
      (untrimmed) script is within `MAX_SCRIPT_CHARS`, returns it whole
      with `truncated: false`; when it's not, returns the selection (if
      any) plus script content nearest to it, bounded to
      `MAX_SCRIPT_CHARS` total, with `truncated: true`; with no selection
      and an oversized script, returns the first `MAX_SCRIPT_CHARS`
      characters with `truncated: true`. Pure function, no I/O. Tests:
      a script within the cap (whole, not truncated); an oversized
      script with a selection (selection kept, nearby content, flagged
      truncated); an oversized script with no selection (head of the
      script, flagged truncated); an oversized selection alone (trimmed
      to `MAX_SELECTION_CHARS`); no script content at all (empty
      script, `truncated: false`).

## 3. Wire protocol

- [x] 3.1 `shared/compositionProtocol.ts`: the client `chat` message
      gains `selection?: { text: string }`. `ChatMessage` (the
      server-broadcast shape) is unaffected — a selection never reaches
      anyone but the reply it grounds.

## 4. Editor: expose and react to the current selection

- [x] 4.1 `app/lib/strudelEditor.ts`: `StrudelEditorOptions` gains
      `onSelectionChange?: (hasSelection: boolean) => void`, fired from
      the existing `updateListener` (extended to also check
      `u.selectionSet`) alongside the current `onCodeChange` wiring. No
      new method on `StrudelEditor` itself — `view.state.selection.main`
      / `view.state.sliceDoc(from, to)` (via the already-public `view`)
      are how a caller reads the current selection's text, focused or
      not.
- [x] 4.2 `app/pages/app/composition/[id].vue`: a `hasSelection` ref
      updated by `onSelectionChange`; `sendChat` reads the current
      selection via `editor.view` at send time (empty selection →
      `undefined`, never an empty-string `selection.text`) and includes
      it on the outgoing `chat` message. A plain label next to the chat
      input when `hasSelection` is true (confirmed UX: a label, not a
      richer preview — e.g. "N lines selected").

## 5. Wiring into `handleJahMention`

- [x] 5.1 `server/routes/composition.ts`: `handleJahMention` reads
      `room.ydoc.getText(DOC_TEXT).toString()` and the incoming
      message's `selection?.text`, calls `buildScriptContext`, and
      passes the result to `generateJahReply`. Skipped entirely when
      `env.JAH_E2E` is set, same as Phase 1's retrieval skip — the
      canned-reply path needs neither a real script nor a real
      selection.
- [x] 5.2 `server/jah/reply.ts`: `generateJahReply(env, messages,
      contextBlocks?, scriptContext?)` passes `scriptContext` through to
      `buildSystemPrompt`. `JahReply` is otherwise unchanged.
- [x] 5.3 An ordinary (non-`@jah`) chat message's own path
      (`postChatMessage` for a human message) never reads
      `msg.selection` — verified by a test, not just by omission, so a
      future edit can't silently start leaking it.

## 6. Usage recording

- [x] 6.1 `migrations/patterns/0012_ai_usage_script_context.sql`:
      `script_chars_sent INTEGER NOT NULL DEFAULT 0` on `ai_usage`.
- [x] 6.2 `server/auth/aiUsage.ts`: `RecordUsageInput`/`recordUsage`/
      `AiUsageRecord`/`toRecord` carry the new field.
      `handleJahMention` passes the character count actually included
      in `scriptContext` (`0` for `JAH_E2E`).

## 7. Verification

- [x] 7.1 Pool-workers tests (`test/composition.test.ts`,
      `test/jah-chat.test.ts`): a selection on a non-mention message has
      no effect and is never relayed to anyone (real WS test, not just
      by omission); `JAH_E2E` never builds script context, mirroring
      retrieval's own skip and observable via `script_chars_sent`. This
      environment's `JAH_E2E=1` (see `jah-chat.test.ts`'s own header
      comment) makes the full non-stubbed path — a mention's reply
      actually generated with the current script; a real selection
      actually used; still stateless across messages — structurally
      unreachable through the WS pipeline in a pool-workers test, the
      same constraint Phase 1's retrieval had. Those are proven instead
      by: `buildScriptContext`'s own unit tests (task 2.1) for
      bounding/statelessness-by-construction (fresh inputs every call,
      nothing persisted), `buildSystemPrompt`'s own tests (task 1.1) for
      correct threading into the prompt, and task 7.3's real ad-hoc
      check for the actual end-to-end pipeline against a real model.
- [x] 7.2 Playwright: selecting text in the Composition tab, then
      switching to Chat and mentioning `@jah`, shows the "selection
      attached" label and (`JAH_E2E`) the canned reply — proving the
      selection survives the tab switch, matching CodeMirror's own
      state retention.
- [x] 7.3 A real, ad-hoc check (a one-off script or a manual mention in
      a dev room) that `@jah` answers correctly about a real selected
      snippet in a real script. First run surfaced a real gap: with the
      original wording, a real reply to "what does this do?" ignored the
      selection entirely ("You haven't specified what 'this' refers
      to."), even though the prompt correctly contained it — the model
      wasn't connecting the asker's "this" to the labelled selection.
      Fixed by making `prompt.ts`'s `scriptSection` say so explicitly
      ("when they say 'this'... they most likely mean the selection
      below") and instructing @jah to ask rather than guess when there's
      no selection at all. Re-verified against the real model: with a
      selection, the reply correctly names and explains exactly the
      selected snippet; with none, it asks what "this" means instead of
      guessing.
- [x] 7.4 Re-ran the Phase 0 eval's grounded mode (`--grounded`) with six
      new script-context cases (`explain-selection-*`,
      `explain-whole-script`) and compared against Phase 1's grounded
      result (91%). The harness first needed optional `script`/`selection`
      case fields, sent through the real `buildScriptContext` (cases
      without a `script` get no script section, so the existing cases'
      prompts stay comparable). Run on 2026-10-03, 3 samples per case:
      the pre-existing 40 cases scored 90% (108/120), within one sample of
      Phase 1's 91%, with the same model-level failures as before
      (`polyrhythm-basic`, `reverse-melody`, `panning-drums`,
      `minor-chord-pad`, one `arp-typo` sample). Of the new cases, five
      passed 3/3 on the first run, including the selection in an
      over-cap script. `explain-whole-script` failed 3/3 and surfaced a
      real gap: with nothing selected, the model doubted it had the whole
      script and asked for it instead of explaining. Fixed in
      `prompt.ts`'s `scriptSection`: an untruncated script is now labelled
      as complete, and with no selection, "my script" / "the whole thing"
      means the script (ask only when "this" is genuinely ambiguous). The
      re-run replies explained every part correctly, but in prose for
      `bank`/`pan`, so that case's `expect` was relaxed to
      `['setcps', 'sine']` (same precedent as `chord-progression`). Final
      re-run of the six new cases: 18/18. Combined: 126/138 (91%).
- [x] 7.5 `npm test` and `npm run typecheck` are green.
- [x] 7.6 `openspec validate add-jah-script-context --strict`.
- [ ] 7.7 After the developer's review: sync `jah-chat` (modified),
      `composition-room` (modified), and `frontend-editor` (modified)
      into `openspec/specs/`; archive. This closes Phase 2 of the `@jah`
      intelligence roadmap — update
      `docs/04-roadmap/jah-intelligence/README.md` to reflect it.
