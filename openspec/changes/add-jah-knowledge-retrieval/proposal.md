## Why

This is the change that makes `@jah` actually good, not just documented-
about: it grounds every reply in Strudel's real documentation and the
curated pattern library, and closes out Phase 1 of
`docs/04-roadmap/jah-intelligence/`.

**A correction to the roadmap's own sequencing, found while starting
this**: Phase 0 planned a separate change, `add-jah-retrieval-seam`, to
make `@jah`'s reply assembly accept pluggable context and return sources
— *before* any real retrieval existed, specifically so retrieval could be
built against a stable seam. That change was never actually proposed or
built; only `add-jah-eval-harness` shipped from Phase 0. Building the
seam in isolation now, three changes later, with this being its only
consumer, would add ceremony without the isolation benefit it was meant
to provide. This change folds that seam's scope in directly.

## What Changes

- **`server/jah/prompt.ts`**: `JAH_SYSTEM_PROMPT` (a constant) becomes
  `buildSystemPrompt(contextBlocks?)`. With no blocks, its output is
  byte-identical to today's constant — the "no behaviour change" promise
  the original seam change made.
- **A retrieval step**, run before every real model call: resolves any
  function names explicitly referenced in the mention (`` `lpf` ``,
  `.lpf`) via `findChunkByName` (`add-knowledge-store`), and always also
  runs `searchChunks` (`add-knowledge-search`) against the mention's own
  text — merged, deduplicated, capped at a small number of chunks so the
  prompt stays bounded.
- **`server/jah/reply.ts`**: `generateJahReply` takes the retrieved
  context and returns `sources` alongside the reply text.
- **Sources are real, structured data on the wire** (`ChatMessage` gains
  an optional `sources` field) — not deferred, because the data itself
  isn't a UI question. **How they're displayed is a v1 placeholder**: a
  plain line appended to the rendered message text via existing markdown
  rendering, no new UI component. Visual treatment (chips, a source
  panel, hover previews) is explicitly left for a later, separate pass —
  per the roadmap's own repeated note that display decisions need the
  developer's input, not a unilateral call.
- **`ai_usage`** gains columns recording how much retrieval a reply used
  (a new migration) — the audit trail Phase 0 always intended.
- **The `JAH_E2E` test stub** is extended so retrieval is exercisable
  offline — tests never call a real model, a real embedding, or the real
  Vectorize index.

## Capabilities

### New Capabilities
- `jah-grounding`: reply assembly accepts context and returns sources
  (what Phase 0's `add-jah-retrieval-seam` would have been), and how a
  mention's retrieval actually works — resolving named functions exactly
  and searching semantically, merged and bounded.

### Modified Capabilities
- `jah-chat`: "Every `@jah` Reply Is Recorded" extends to capture
  retrieval usage; a new requirement that a grounded reply shows its
  sources.

## Impact

- **New code:** `server/jah/retrieval.ts` (or similar — exact module
  boundary is a design.md call), its tests.
- **Touched:** `server/jah/prompt.ts`, `server/jah/reply.ts`,
  `server/routes/composition.ts` (`handleJahMention`),
  `shared/compositionProtocol.ts` (`ChatMessage`), `app/lib/chatMessages.ts`
  (minimal source-line rendering), `server/auth/aiUsage.ts` (+ a new
  migration).
- **Not touched:** the room document, the editor, any code-card behaviour,
  the model itself, any prompt content beyond the new reference section.
- **Depends on:** `add-knowledge-store` (`findChunkByName`),
  `add-knowledge-search` (`searchChunks`) — both archived. **Completes**
  Phase 1 of the `@jah` intelligence roadmap.
