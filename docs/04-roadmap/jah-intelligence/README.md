# `@jah` intelligence — handover

Status: **planned, nothing implemented.** Written 2026-09-21 after a design
discussion with the developer. Read this file first, then the phase brief
you are working on. Each phase brief lists its OpenSpec changes; propose
and build **one change at a time** (see *Ground rules*).

## Why

`@jah` (the red lion in the Composition Room chat) is a placeholder. Every
reply is generated from a single static prompt (`server/jah/prompt.ts`: an
identity, a style guide and a short cheat-sheet) plus the one message that
mentioned it. It knows nothing about the script in the editor, makes
mistakes about Strudel, and cannot be trusted as a source.

## Goal — what "done" looks like (end of Phase 6)

`@jah` answers with authority from Strudel's own documentation, sees the
whole script and the part the asker has highlighted, explains code, finds
library patterns, diagnoses evaluation errors and proposes fixes, and
composes new pieces. **It only ever proposes code; a human applies it.**

## Decisions already made — do not reopen without asking the developer

1. **Docs come from the `refers_to/strudel` git submodule**, not from
   scraping strudel.cc. The submodule is registered in `.gitmodules`
   (`https://codeberg.org/uzu/strudel.git`, `update = none`, so CI and
   normal clones skip it) and is pinned at commit `8f81463`; the
   submodule's commit **is** the version pin. It matches the installed
   `@strudel/*` packages (core 1.2.6, webaudio and codemirror 1.3.0).
2. **Function docs are extracted with Strudel's own JSDoc tooling**
   (`jsdoc` + `jsdoc-json`, config `jsdoc/jsdoc.config.json` in the
   submodule), not with a hand-written parser.
3. **One taxonomy for docs and patterns.** Every chunk carries the same
   metadata (kind, title, category, tags, source, version). A doc chunk's
   `category` comes from the Strudel site's own page structure — the site's
   MDX pages are mostly headings with `<JsDoc name="Pattern.slow" />`, so
   page = category, heading = function. No hand curation.
4. **Refreshing the corpus is a rare manual act**: `npm run
   knowledge:refresh` builds one generated chunk file from the pinned
   submodule and the developer commits it. **Deploys never contact
   Codeberg.** (How the file reaches D1 and the index is Open Decision 1.)
5. **`@jah` proposes, humans apply.** It never writes into the shared
   document by itself. "Apply to editor" (Phase 5) **overwrites the whole
   document and stops playback**; it is offered to editors only. No
   targeted patching, no merge logic.
6. **Context comes with the mention.** The server already holds the room's
   document (`room.ydoc`, text key `DOC_TEXT = 'strudel'` in
   `server/routes/composition.ts`), so the whole script is read
   server-side. Only what the server cannot know is sent by the asker's
   client: the current selection and (Phase 5) the last evaluation error.
   Other participants' selections are ignored.
7. **Retrieval has two modes:** lookup by name for named functions, and
   meaning-based search for vague questions and for patterns. Whether a
   vector index is needed at all is decided by the eval (Open Decision 2).
8. **Orchestration stays on the Vercel AI SDK** already in use
   (`generateText`, `workers-ai-provider`, AI Gateway `jaime-jah`). No
   LangChain. Retrieval is written as plain functions that can be turned
   into AI SDK tools later.
9. **A pattern has three layers:** the code text (exact lookup), musical
   features computed from its events and mini-notation tree
   (deterministic), and a functional description written by `@jah` (what
   each function does there and why — grounded in the docs, reviewable as
   a diff). Mood and vibe come from the human-assigned tags, never from a
   model's opinion.
10. **The AST is an extractor and locator, not something to embed.**
    Trees embed poorly; features derived from them embed well.
11. **The eval harness comes first** and runs at every phase.

## Open decisions — resolve inside the named change's `design.md`

| # | Decision | Where | Notes |
|---|---|---|---|
| 1 | How the committed chunk file reaches D1 (and the index): loaded on deploy when the file changed (like `content/patterns`), or loaded by `knowledge:refresh` itself | Phase 1 `add-knowledge-store` | Deploy-time keeps the live store in step with the file; refresh-time matches the "one-time setup" mental model. Ask the developer. |
| 2 | Which retriever mix: lookup-only, D1 full-text, Vectorize, or hybrid; which embedding model | Phase 1 `add-jah-knowledge-retrieval` | Decide from the Phase 0 eval, not up front. Vectorize dimensions are immutable once created. |
| 3 | Where pattern features are computed and stored (deploy reconcile vs. a refresh-style script) | Phase 3 | |
| 4 | Size caps for the script and selection sent with a mention | Phase 2 | Prompt cost rises; revisit the daily caps (25 per user / 150 global). |
| 5 | Which model for compose and debug | Phases 5–6 | Llama 3.3 70B today; a stronger model through the Gateway is likely. Eval-driven. |
| 6 | **UX** — sources chips, the "selection attached" indicator, the Apply action, how errors surface | Phases 1, 2, 5 | **Discuss with the developer before designing UI.** Do not decide UI unilaterally. |

## Codebase map (verified 2026-09-21)

| Concern | Where |
|---|---|
| `@jah` prompt (identity, style, cheat-sheet, examples) | `server/jah/prompt.ts` (`JAH_SYSTEM_PROMPT`) |
| The one model call | `server/jah/reply.ts` — `generateJahReply(env, messages)`; model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, Workers AI through AI Gateway `jaime-jah`; `JAH_E2E` returns a canned reply |
| Mention classification, kill switch, availability | `server/jah/route.ts` (`classifyMention`, `isJahEnabled`, `jahAvailability`) |
| Daily caps | `server/jah/caps.ts` (`underCaps`, counts rows of `ai_usage`) |
| Where a mention becomes a model call | `server/routes/composition.ts` — `handleJahMention` (builds `[{ role: 'user', content: mention.rest }]`, calls `generateJahReply`, posts the reply, calls `recordUsage`); `room.jahBusy` allows one request in flight per room |
| Usage audit | `server/auth/aiUsage.ts` (`recordUsage`); table `ai_usage` in migration `migrations/patterns/0006_ai_access_and_usage.sql` |
| Wire protocol | `shared/compositionProtocol.ts` — client `chat` message is `{ t: 'chat', text }`; server `welcome` carries `jah` availability |
| Chat page, sending, cards | `app/pages/app/composition/[id].vue` (`sendChat`, `provider.sendChat`, code cards, `onError` from the editor) |
| Editor wrapper | `app/lib/strudelEditor.ts` — `createStrudelEditor`; `onError` receives **only `err.message`** (no line/column); `editor.view` is the CodeMirror `EditorView` |
| Mention helper | `app/lib/jahMention.ts` |
| Headless Strudel evaluator | `scripts/patterns/lib/triage.mjs` (`createTriage`) — used by `npm run pattern:check --fast` |
| Existing (real-model, manual) prompt eval | `scripts/jah-prompt-eval.mjs` + `scripts/jah-prompt-eval.wrangler.jsonc` — about $0.06 a run, not in `npm test` |
| Pattern library | `content/patterns/*.md` reconciled to D1 by `scripts/sync-patterns.mjs` on deploy; API under `server/api`; migrations in `migrations/patterns/` (latest is `0008_pattern_favorite.sql`, so the next is `0009`) |
| Pattern ingestion skill | `.claude/skills/add-patterns/`, spec `openspec/specs/pattern-ingestion/` |
| Tests | `npm run test:scripts` (Node, `scripts/**/*.test.mjs`), `vitest` with pool-workers (`test/*.test.ts`, e.g. `jah-chat`, `jah-reply`, `jah-route`, `jah-caps`, `composition`), Playwright (`e2e/`, not run by CI) |
| Existing specs to modify | `openspec/specs/jah-chat/` (notably "Each `@jah` Reply Is Stateless", "Every `@jah` Reply Is Recorded"), `composition-room`, `frontend-editor`, `pattern-library`, `pattern-ingestion` |

## Ground rules for the assistant

- **OpenSpec, one change at a time.** Use the `openspec-propose` skill to
  create the change, `openspec validate <name> --strict` before asking for
  review, the developer reviews **before** apply, and archive only after
  their review (`openspec-archive-change`). Sync is a manual merge into
  `openspec/specs/`. Propose each change just in time — do not pre-write
  later phases' specs.
- **Ask before improvising.** Do what the change's tasks say. If an extra
  check or a different approach would help, propose it and wait.
- **Deploy = commit + push via CI**, never a manual `npm run deploy`. Per
  `AGENTS.md`: commit locally as often as needed, **push only when a
  change is archived**, and run `npm test` locally before that push.
- **No real model in tests.** Follow the `JAH_E2E` precedent
  (`server/jah/reply.ts`): a stub flag returns canned output so tests and
  e2e never spend money or need Workers AI access. Each new remote
  dependency (embeddings, index) needs its own stub.
- **Typecheck must be clean** (`npm run typecheck`, not part of
  `npm test`) — fix every error, never call one "pre-existing".
- **Ignore archive folders** (`docs/04-roadmap/01-archive/`,
  `openspec/changes/archive/`) when searching.
- **Windows / Git Bash:** backslash sequences in inline scripts get
  mangled — write script files; don't run two builds against `.output` at
  once; kill leftover `wrangler`/`workerd` processes after test runs.
- **Strudel content is AGPL.** Every chunk records its source path at the
  pinned commit, the version and the licence, and the chat credits
  sources. Chunks may be verbatim from the docs.

## Risks and spikes

| Risk | Handling |
|---|---|
| Strudel's evaluator may not run inside a Worker (needed by the verify step in Phases 5–6) | `spike-strudel-eval-in-worker` in Phase 5; fallback is verifying in the browser |
| A general embedding model may embed Strudel code and mini-notation poorly | Phase 0 eval decides; pattern similarity uses derived features and descriptions, not raw code |
| Doc examples that fail in our engine (like `.piano` did) | Phase 1 runs every doc example through triage and compares with Strudel's own snapshot; failures are engine gaps to report, not chunks to hide |
| Llama 3.3 may be weak at code or tool calls | Phases 5–6 allow a stronger model through the Gateway; caps and `ai_usage` already meter spend |
| Bigger prompts (script + chunks) raise cost per mention | Revisit caps in Phase 2; record token use in `ai_usage` |
| Corpus drift when Strudel updates | Bump the submodule, run `knowledge:refresh`, review the diff |

## Out of scope (explicitly dropped or deferred)

Agents SDK with per-room memory (formerly Phase 7), LangChain, audio
analysis of patterns, `@jah` writing into the shared document or acting as
a live participant, private/direct messages, a real model selector.
