# Roadmap: AI in Composition Room

One roadmap, no phase number. Held until Composition Room's
implementation is done, not just spec'd — this is what comes right
after. Four OpenSpec changes, ordered by dependency; your recent pace
(4 changes landed in a single day, `08-30`) suggests this whole list is
close to a week, not four.

---

## 1. `add-ai-chat-provider`

**Context**: the room's `chat` message type already exists
(`shared/compositionProtocol.ts`) as ephemeral human-to-human text.
Per `proposal.md`, the AI's job here is to become another participant
in that same channel — not a new UI surface. No LLM binding exists yet;
`wrangler.jsonc` has no `AI` or AI Gateway entry.

**Decision to make first — provider**:
- **Workers AI** (`env.AI` binding, Cloudflare-hosted open models):
  no external dependency, runs at the edge, cheapest, simplest to wire
  into a Worker that's already all-Cloudflare. Trade-off: weaker
  reasoning for nuanced "why isn't my pattern doing X" coding help than
  a frontier model.
- **AI Gateway + an external model** (e.g. Claude): better reasoning
  quality, plus AI Gateway gives caching/rate-limiting/analytics for
  free. Trade-off: external API cost, a stored secret to manage, one
  more moving part outside Cloudflare's own stack.
- Pick one and record it as a decision, the same way `design.md` did
  for Yjs vs. `@codemirror/collab` — don't let it become an implicit
  default because Workers AI happened to be the easy path.

**Scope**: read-only. The AI sees the current `Y.Doc` (rendered to
plain Strudel source) as context, answers Strudel questions in the
chat panel, writes nothing back to the document. Gated behind the
confirmed-email Authenticated User check that already exists
(`server/routes/auth/callback.get.ts` / `confirmUser`) — reuse it, verify
it against the session before letting a `chat` message reach the model.

**Open implementation question**: how is the AI addressed? An `@ai`
prefix convention, a dedicated lane in the chat UI, or every message
routed to it? Needs a decision, not an assumption.

**Testing**: unit test around the provider call with a mocked binding;
e2e — two clients in a room, one confirmed-email user gets an AI
response, an unauthenticated user's chat message doesn't trigger one.

**Risk**: LLM latency inside a WebSocket-driven chat flow. Consider
streaming tokens back as they generate rather than blocking on the full
response — Cloudflare's providers support streaming; the room protocol
would need a partial-message frame type if so.

---

## 2. `add-ai-pattern-awareness`

**Context**: `PATTERNS_DB` (Phase 4's Catalog D1) already exists with
searchable curated patterns. Vectorize-based similarity search was
noted as an undecided later option in the domain model — not needed
here.

**Approach**: keyword/tag search against `PATTERNS_DB`, triggered by
the user's question or the current document's content, results
injected into the model's context as a lightweight RAG pass — reusing
whatever search logic already backs the Pattern library's browse/filter
UI rather than writing a second search implementation.

**Testing**: ask a question with an obvious curated-pattern answer,
assert the response references a real pattern id/name from the catalog
rather than an invented one.

---

## 3. `add-ai-doc-edits`

**Context**: this is the one that actually touches the collaborative
document, and it's harder than 1–2 because it has to go through the
same `Y.applyUpdate` path as every human edit — not a side channel.

**Decision to make first — how does the AI write**:
- **As a peer**: the AI "connects" like any editor, subject to the
  existing editor/viewer write-drop logic in the DO. Consistent with
  everything else in the room, but there's no real WebSocket connection
  behind it — it'd be a fabricated peer, adding complexity for
  consistency's sake.
- **Server applies directly**: the Worker calls `Y.applyUpdate(ydoc,
  update)` on the AI's behalf and relays it exactly like any other
  update, with its own authorization check (confirmed-email gate again)
  instead of borrowing the peer-role mechanism. Simpler, since the DO
  already does apply-and-relay for every update — this just adds a
  second caller.

**Things this surfaces that need explicit handling, not assumption**:
- **Attribution**: does the AI get an awareness entry (name + color,
  like `y-remoteSelections` gives every human editor) so its change is
  visibly "from Claude" rather than looking like it came from nowhere?
- **Undo scoping**: `y-codemirror.next`'s `undoManager` is typically
  origin-scoped — worth confirming a human's Ctrl-Z doesn't undo the
  AI's edit and vice versa, since that'd be a confusing surprise in a
  live multi-editor session.
- **Staleness**: the AI generates a suggestion against a doc snapshot;
  if the doc changes before the suggestion lands, Yjs will still merge
  it, but the merge might not be what the AI "intended" when it wrote
  the suggestion. Worth deciding whether to re-check staleness before
  applying, or just accept CRDT merge semantics as good enough — that's
  the whole point of choosing Yjs in the first place.

**Testing**: e2e — AI proposes an edit, all connected clients see it
update; a human edits on top of it afterward with no corruption; the
undo-scoping case above, explicitly.

---

## 4. `add-ai-melody-tool`

**Context**: builds on a MIDI-to-mininotation pipeline already sketched
separately (parse MIDI → note-event IR → deterministic quantizer → LLM
refinement pass → round-trip validation through `@strudel/mini` before
anything is shown). This change is "make that a tool the AI can invoke
from chat," not "build the pipeline" — that part already exists as a
starting point.

**New surface needed**: a way to hand the AI a source file from inside
the chat panel (drag a MIDI file into the room?), and a response path —
does it come back as a chat message with a preview, or does it write
straight into the document via #3's edit path? Given the room already
has an explicit-evaluation model (Ctrl-Enter, not per-keystroke), a
chat-preview-then-insert flow probably fits the room's existing
interaction style better than an unprompted direct write.

**Testing**: real fixtures exist to reuse rather than inventing new
ones — the sample MIDI files from the earlier Java prototype
(`in_blue.mid`, `interstellar.mid`, `azul.mid`, `shape.mid`) already
have known characteristics (one polyphonic, one monophonic, etc.)
documented alongside them.

**Risk**: MIDI parsing + LLM refinement + validation is a multi-second
chain running inside a synchronous chat turn. Likely needs a
"generating…" placeholder message that gets replaced when the result is
ready, rather than blocking the WebSocket connection.

---

## Open questions to resolve before starting #1

- **Chat history — persisted or ephemeral?** The room's human chat is
  deliberately ephemeral today (cleared on restart/empty room). AI
  conversations might be worth persisting for continuity across a
  session, which would be a deliberate departure from that existing
  norm, not a default to slide into.
- **Workers AI vs. AI Gateway** — not evaluated yet against this
  specific use case (latency inside a live collaborative session,
  quality needed for Strudel-specific help). Worth a quick spike before
  #1 rather than deciding from first principles at the keyboard.
