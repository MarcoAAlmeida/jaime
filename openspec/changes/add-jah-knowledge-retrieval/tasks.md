## 1. The prompt seam (byte-identical with no context — Phase 0's original guarantee)

- [x] 1.1 `server/jah/prompt.ts`: `buildSystemPrompt(contextBlocks:
      string[] = [])`; `export const JAH_SYSTEM_PROMPT =
      buildSystemPrompt()` unchanged in value. Test: `buildSystemPrompt()`
      equals the current `JAH_SYSTEM_PROMPT` byte-for-byte; with context
      blocks, each block's text appears in the output, in order.
- [x] 1.2 Run the existing `test/jah-reply.test.ts` / `jah-chat.test.ts` /
      `jah-route.test.ts` / `jah-caps.test.ts` unmodified and confirm they
      still pass — the guarantee this task group exists to prove.

## 2. Retrieval

- [x] 2.1 `server/jah/retrieval.ts`: candidate extraction (backtick-quoted
      and dot-prefixed identifiers, lowercased, deduplicated). Tests: a
      mention with a backtick name, a dot-prefixed name, both, neither,
      and a candidate list that would falsely match ordinary English
      words if the pattern were broader (prove it doesn't).
- [x] 2.2 `retrieveContext(deps, mentionText)` where `deps` is an
      injectable `{ findChunkByName, searchChunks }` (or equivalent —
      whatever shape makes 2.3's fakes-only tests clean): exact lookup for
      every candidate, always also a semantic search on the raw mention
      text, merge with exact-first ordering, dedupe by id, cap at
      `MAX_CONTEXT_CHUNKS`. Tests with fakes for both: exact-only,
      semantic-only, both with overlap (deduped), over the cap (bounded,
      exact hits kept first), and nothing found (empty result).
- [x] 2.3 Context-block formatting: one string per surviving chunk (title,
      category, text, and for function chunks its params/examples). Test
      the shape is sensible for a function chunk and for a concept chunk.
- [x] 2.4 `retrieveContext` against the vitest pool's real local D1
      (seeded with the real corpus already) with fake `ai`/`vectorize`:
      a real exact-lookup hit (e.g. `` `lpf` ``) resolves for real; a
      semantic-only fake match resolves to real chunk content via the
      real `findChunkByName`.

## 3. Wiring into `handleJahMention`

- [x] 3.1 `server/routes/composition.ts`: call `retrieveContext` before
      `generateJahReply` for a real (non-`JAH_E2E`) request; keep its
      `sources` in `handleJahMention`'s own scope (used directly in 3.3/4.2
      — no need to round-trip it through `generateJahReply`/`JahReply`,
      simplified from an earlier draft of this task that had it echoed
      back for no benefit); skip retrieval entirely when `env.JAH_E2E` is
      set (the canned-reply path is unaffected, no seeded store needed
      for it).
- [x] 3.2 `server/jah/reply.ts`: `generateJahReply(env, messages,
      contextBlocks?)` calls `buildSystemPrompt(contextBlocks)`. `JahReply`
      is otherwise unchanged — `reply.ts` stays the model-call seam,
      `retrieval.ts` stays the knowledge seam, and sources never need to
      pass through it.
- [x] 3.3 `jahChatMessage(text, sources?)`; `postChatMessage` carries
      `sources` through to the room's chat.

## 4. Usage recording

- [x] 4.1 `migrations/patterns/0011_ai_usage_retrieval.sql`:
      `retrieval_chunks_used`, `embedding_tokens` columns on `ai_usage`.
- [x] 4.2 `server/auth/aiUsage.ts`: `RecordUsageInput`/`recordUsage`/
      `AiUsageRecord`/`toRecord` carry both new fields. `handleJahMention`
      passes `sources.length` and the embedding call's token count (`0`
      when retrieval never made a real embedding call). Discovered during
      implementation: Workers AI's embedding output (`Ai_Cf_Baai_Bge_*_Output`)
      carries no usage/token field at all today, so `embeddingTokens` is
      always `0` in practice for now, not only on the `JAH_E2E` path — the
      column and plumbing are in place for whenever Workers AI reports it
      (matches design.md's own "Accepted simplification" risk note).

## 5. Wire protocol and minimal rendering

- [x] 5.1 `shared/compositionProtocol.ts`: `ChatMessage.sources?:
      Array<{ id: string, title: string, sourceUrl: string | null }>`.
- [x] 5.2 `app/lib/chatMessages.ts`: `toChatMessages` appends one markdown
      line ("*Sources: [title](url), …*", plain text for a null
      `sourceUrl`) to an assistant message's text when `sources` is
      non-empty, before building `parts`. Test: a message with sources
      gets the line appended; one without is unchanged; a source with no
      `sourceUrl` renders as plain text, not a broken link.

## 6. Verification

- [x] 6.1 A real, ad-hoc check (a one-off script or a manual mention in a
      dev room) that a mention naming a real function (e.g. "what does
      `.euclid` do?" — a documented gap from the Phase 0 baseline) now
      answers grounded in the real corpus, with sources shown. Verified
      2026-09-24 against the live deploy: `retrieveContext` returned the
      real `euclid` chunk (exact) plus `_euclidRot`/`euclidish`/a mini-
      notation example (semantic), and the real model reply correctly
      named both parameters and gave a working example — a mention the
      Phase 0 baseline recorded as a gap.
- [x] 6.2 Re-run the Phase 0 eval (`npm run jah:eval`) against the
      grounded prompt and compare with the committed baseline
      (`scripts/jah-eval/baseline.json`) — the whole point of Phase 0
      existing. Needs the developer's go-ahead before spending money,
      per established policy. Record the result; update the baseline only
      if the developer asks. The harness itself had no retrieval step
      yet — extended `scripts/jah-eval/lib/model.mjs`'s `createModelCaller`
      with a `grounded` option (real `retrieveContext` per case, mirroring
      `handleJahMention` exactly) and `run.mjs` with a `--grounded` flag
      (developer-approved addition, not in the original task breakdown).
      Result 2026-09-25 (`--grounded --compare`, 3 samples, same case set):
      overall 86% → 87% (docs 90%→90%, fix 90%→90%, compose 73%→77%).
      `euclidean-rhythms` (the documented gap 6.1 also checked) went
      0%→100%, `reverb-pad` 0%→100% — but `chord-progression` 100%→0%,
      `filtered-bass` 100%→33%, `panning-drums` 33%→0%, `reverse-melody`
      100%→67%. Net roughly flat/slightly up, but a real, mixed result,
      not a clean win — full report not committed (baseline.json
      untouched, per instructions); path was printed at run time.
- [x] 6.3 `npm test` and `npm run typecheck` are green.
- [x] 6.4 `openspec validate add-jah-knowledge-retrieval --strict`.
- [ ] 6.5 After the developer's review: sync `jah-grounding` (new) and
      `jah-chat` (modified) into `openspec/specs/`; archive. This closes
      Phase 1 of the `@jah` intelligence roadmap — update
      `docs/04-roadmap/jah-intelligence/README.md`/`index.md` to reflect
      it, per the developer's direction at that time.
