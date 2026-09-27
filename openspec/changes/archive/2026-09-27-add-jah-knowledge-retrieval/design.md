## Context

See `proposal.md` for why, including the correction to the roadmap's
sequencing (Phase 0's `add-jah-retrieval-seam` folded in here). Read
`docs/04-roadmap/jah-intelligence/README.md` and `phase-1-knows-strudel.md`
for the roadmap framing.

**What already exists, verified in code:**
- `server/jah/reply.ts` — `generateJahReply(env, messages)` calls
  `generateText({ system: JAH_SYSTEM_PROMPT, messages })`; `JAH_E2E`
  short-circuits to a canned reply, touching neither `env.AI` nor any
  binding.
- `server/jah/prompt.ts` — `JAH_SYSTEM_PROMPT` is a plain string
  constant, `IDENTITY + STYLE + CHEATSHEET + JAH_EXAMPLES`.
- `server/routes/composition.ts`'s `handleJahMention` — the only caller
  of `generateJahReply`; builds `[{ role: 'user', content: mention.rest
  || 'Hello!' }]`, posts the reply via `jahChatMessage(reply.text)`
  (`{ clientId, name, avatarUrl, text, at }`), then `recordUsage`.
- `server/auth/aiUsage.ts` / migration `0006` — `ai_usage` has no
  retrieval-related columns yet.
- `shared/compositionProtocol.ts`'s `ChatMessage` — `{ clientId, name,
  text, at, avatarUrl? }`, no field for structured extras.
- `app/lib/chatMessages.ts`'s `toChatMessages` — maps each `ChatMessage`
  to one `parts: [{ type: 'text', text: m.text }]`; this is the one
  seam that turns wire data into what the chat actually renders,
  client-side, with no protocol coupling to the UI library.
- `server/catalog/knowledge.ts` — `findChunkByName(db, name)` (exact, by
  id or synonym) and `searchChunks(ai, vectorize, db, query, topK)`
  (semantic), both built, both currently uncalled from anywhere.
- Existing tests (`test/jah-reply.test.ts`, `jah-chat.test.ts`,
  `jah-route.test.ts`, `jah-caps.test.ts`) import `JAH_SYSTEM_PROMPT` as
  a constant and assert on its exact content — Phase 0's own guardrail
  said these pass **unchanged**.

## Goals / Non-Goals

**Goals:**
- Every mention is checked against the knowledge store before the model
  is called; relevant knowledge is included in what the model sees.
- Sources are real, structured wire data from day one.
- `JAH_SYSTEM_PROMPT`'s existing value and every test asserting on it
  keep working with zero changes.
- Tests never call a real model, embedding, or Vectorize index.

**Non-Goals:**
- Visual polish for how sources are displayed — a plain, unstyled line
  is the whole of this change's UI work, deliberately (see decision 5).
- Changing what `@jah` is *allowed* to do (still discussion-only, still
  stateless across messages, still gated the same way).
- A second retrieval pass over the reply itself (checking the model's
  own output against the store) — that belongs with the debugger/composer
  phases' verify step, not here.

## Decisions

### 1. `JAH_SYSTEM_PROMPT` becomes a zero-arg call of `buildSystemPrompt`

```ts
export function buildSystemPrompt(contextBlocks: string[] = []): string {
  const reference = contextBlocks.length > 0
    ? `\n\nReference material — use this to ground your answer, and say so plainly if it doesn't cover the question:\n\n${contextBlocks.join('\n\n---\n\n')}`
    : ''
  return `${JAH_BASE_PROMPT}${reference}\n\n${JAH_EXAMPLES}`
}

export const JAH_SYSTEM_PROMPT = buildSystemPrompt()
```
`JAH_SYSTEM_PROMPT` keeps existing as a constant, with the exact same
value as before (`contextBlocks` defaults to empty, `reference` is then
`''`) — every existing test importing it keeps passing with no edits.
`generateJahReply` calls `buildSystemPrompt(contextBlocks)` instead of
using the constant directly.

### 2. Retrieval module: `server/jah/retrieval.ts`

```ts
export interface RetrievedSource { id: string, title: string, sourceUrl: string | null }
export interface RetrievalResult { contextBlocks: string[], sources: RetrievedSource[] }

export async function retrieveContext(env: Env, mentionText: string): Promise<RetrievalResult>
```
Steps:
1. **Explicit-name candidates**: match `` `([a-zA-Z][\w.]*)` `` (backtick-
   quoted) and `\.([a-zA-Z][\w]*)\b` (dot-prefixed) in `mentionText`,
   lowercased, deduplicated. Deliberately narrow — this is "did the
   person write something that looks like a function reference", not
   general keyword extraction; a broader heuristic risks false hits on
   ordinary English words matching real short function names (`n`, `s`).
2. Resolve each candidate via `findChunkByName(env.PATTERNS_DB,
   candidate)`; keep the hits, in the order the candidates appeared.
3. **Always** additionally call `searchChunks(env.AI, env.VECTORIZE,
   env.PATTERNS_DB, mentionText, SEMANTIC_TOP_K)` (design decision 3 sets
   `SEMANTIC_TOP_K`).
4. Merge: exact hits first (they're precise, by construction), then
   semantic hits, **deduplicated by chunk id**, capped at
   `MAX_CONTEXT_CHUNKS` total (decision 3).
5. For each surviving chunk, build one context block string (its title,
   category, and text — function chunks also their params/examples,
   concept/example chunks just their text) and one `RetrievedSource`
   (`id`, `title`, `sourceUrl`).
6. If nothing resolves at all, return `{ contextBlocks: [], sources: [] }`
   — `buildSystemPrompt([])` then produces today's exact prompt (decision
   1's guarantee), so a mention the store has nothing for behaves exactly
   as `@jah` does today.

`retrieveContext` is the one new thing `handleJahMention` calls before
`generateJahReply`.

### 3. Bounds: `SEMANTIC_TOP_K = 3`, `MAX_CONTEXT_CHUNKS = 5`

Small numbers, deliberately: the corpus today is ~1,400 chunks and the
developer intends to grow it considerably, so prompt size must stay
bounded independent of corpus size (spec: "The number of context items
is bounded"). Five chunks of typical size (a function's text + a couple
of examples, or a concept's prose) is a few hundred to low thousand
tokens — comparable to or smaller than the existing hand-written
cheatsheet it's supplementing. Tunable constants, not hardcoded inline,
so the eval harness (Phase 0) can be re-run against different values
later without a code change beyond the constant.

### 4. `ai_usage` gains retrieval columns — migration `0011`

```sql
ALTER TABLE ai_usage ADD COLUMN retrieval_chunks_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN embedding_tokens INTEGER NOT NULL DEFAULT 0;
```
(Next migration number — `0009`/`0010` are already used by
`add-knowledge-store`/`add-knowledge-search`.) `retrieval_chunks_used` is
`sources.length`; `embedding_tokens` is the token count Workers AI
reports for the one query-embedding call inside `searchChunks` (`0` when
`retrieveContext` never got that far, e.g. `JAH_E2E`, or when only exact
lookups resolved and semantic search's own tokens weren't tracked back
to this call — see the Open Questions note on this simplification).
`RecordUsageInput` and `recordUsage` gain both fields; `AiUsageRecord`
(`#shared/admin`) gains them too for the admin console's future display
(not itself changed here — reading them is out of this change's scope,
matching how the store's own columns predate the console reading them).

### 5. Sources on the wire, rendered as one plain line — not styled

`ChatMessage` gains `sources?: Array<{ id: string, title: string,
sourceUrl: string | null }>`. `jahChatMessage` takes an optional third
argument. `handleJahMention` passes `retrieval.sources` through to both
`jahChatMessage` and, as `retrieval_chunks_used`, to `recordUsage`.

Rendering, in `toChatMessages`: when `m.sources` is non-empty, append one
line to the message's own text before building its `parts`:
```
\n\n*Sources: [rev](url), [lpf](url)*
```
(a source with no `sourceUrl` renders as plain text, not a link) — using
the chat's *existing* markdown rendering (already applied to every
message), so this needs no new Vue component, slot, or protocol
awareness in the template at all. This is explicitly a v1 placeholder:
real visual treatment (a distinct chip row, a collapsed "sources" toggle,
hover previews) is a UI decision the roadmap has repeatedly flagged as
the developer's to make, not something to decide unilaterally here. The
structured `sources` field is what makes that later polish possible
without touching the protocol again.

### 6. Testing: extend `JAH_E2E`, never touch a real binding

`retrieveContext` itself is tested with injected fakes for
`findChunkByName`/`searchChunks` (dependency-injected, or the function
takes them as parameters — exact shape decided in tasks.md) — no real D1,
AI, or Vectorize call in its own tests. For the existing `JAH_E2E`
end-to-end path (`test/jah-chat.test.ts` and friends), retrieval is
short-circuited the same way the model call already is: when
`env.JAH_E2E` is set, `handleJahMention` skips `retrieveContext` entirely
and calls `generateJahReply` with no context — the canned reply path is
unaffected, and no test needs a seeded local knowledge store to exercise
it. A **new**, separate test exercises `retrieveContext` against the
vitest pool's real local D1 (seeded with the real corpus already, per
`add-knowledge-store`'s `KNOWLEDGE_SEED_SQL`) with fake `ai`/`vectorize`
for the semantic half — proving exact lookup for real, semantic merge
logic with a fake, the same split `add-knowledge-search`'s own tests use.

## Risks / Trade-offs

- **[Retrieval adds latency to every real mention]** → One extra D1 query
  per explicit-name candidate (typically 0-2) plus one embedding call and
  one Vectorize query, all before the model call. Acceptable: the model
  call itself already dominates response time; not measured here, worth
  watching if `@jah` ever feels slower.
- **[The explicit-name heuristic is narrow]** → By design (decision 2);
  it will miss a function named in plain prose with no backticks or dot.
  Semantic search is the catch-all for those cases regardless, so nothing
  is silently unanswerable — just less precisely grounded.
- **[`embedding_tokens` undercounts when only exact lookup fires]** → 
  Accepted simplification (decision 4); revisit if the audit trail's
  accuracy here ever matters enough to track separately.
- **[Sources rendering is deliberately unstyled]** → A real, if modest,
  UX gap versus what a "cites its sources" feature could look like.
  Accepted as this change's honest v1, with the structured data in place
  for a follow-up to improve without another protocol change.

## Migration Plan

Additive throughout: a new migration, a new module, extended function
signatures with backward-compatible defaults (`buildSystemPrompt()`
unchanged, `ChatMessage.sources` optional). No existing route, protocol
field, or behavior is removed. Rollback: stop calling `retrieveContext`
in `handleJahMention` (reverts to today's exact behavior via decision 1's
guarantee); the new migration and unused columns can be left in place
harmlessly.

## Open Questions

- Should `retrieveContext` also consider the room's *own* recent chat
  history (not just the current mention) for candidate function names?
  Deferred — Phase 2 (`add-jah-script-context`) is where `@jah` starts
  seeing more than a single message, and folding history in before that
  exists would be scope creep on this change.
