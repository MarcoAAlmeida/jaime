# Roadmap: @jah in Composition Room

`@jah` is Composition Room's AI participant — discussion always
available, document writes only when the room is paused.

**Phase -1 — `add-responsive-rooms`** — ✅ shipped 2026-09-02: the JAM
room and Composition Room work on a phone held vertically now — header
reflows (a `⋯` overflow menu below `sm`), the editor soft-wraps so
there's no sideways scroll to read code, and the invite button uses the
native share sheet where the device has one. New `responsive-rooms`
spec. No auth, no AI.

**Phase 0 — `add-oauth-signin`:** GitHub sign-in + a minimal profile
(screen name, avatar). A standalone win — a better front door for JAM
and the Pattern library too — and it replaces the assumption every
`@jah` phase rests on: that gating chat behind an emailed magic link is
acceptable friction. It isn't, for "let me try the AI in this room".

## The model, in one place

**Three commands, explicit syntax, routed server-side before any model
call**:
- `@jah <anything>` → **discussion**. Default/fallback — anything not
  matching `fix` or `edit` as the first word after the mention.
- `@jah fix` → **fix**. Diagnoses on request only — never unsolicited,
  never watches the doc and volunteers opinions on its own.
- `@jah edit <instruction>` → **edit**. `<instruction>` is everything
  after the keyword.

| | Discussion | Fix (diagnose) | Fix (apply) | Edit |
|---|---|---|---|---|
| Available when | anytime | anytime | room paused | room paused |
| Writes to doc | never | never | yes | yes |
| Requires | signed-in + `ai_access` | signed-in + `ai_access` | + room paused | + room paused |

**Two independent, gated actions**:
- **Pausing/resuming the room** — only a signed-in user can toggle it.
- **`@jah` replying at all** — only to a signed-in user **on the
  `ai_access` allowlist** (see
  [`99-bucket-list/ai-credits-and-access-control.md`](./99-bucket-list/ai-credits-and-access-control.md)).
  `@jah` costs Marco money per message; access is an explicit list, not
  "has an account".

**`@jah` is ephemeral** — no session persistence needed, matches the
room's existing human chat, which is already ephemeral by design.

**The commands are permission gates, not a vocabulary.**
`<anything>` / `fix` / `edit` decide only whether `@jah` may *write* to
the document. What `@jah` understands is open-ended from the start —
"make this livelier", "give it a dub feel", "why does this sound
muddy", "teach me Hydra feedback" are all handled (as discussion, or as
an edit). New *modes* (`@jah explain`, `@jah teach`) can be added
later; how much `@jah` can do is a prompt-and-tools question, not a
command-count one. The long game is `@jah` as a Strudel — and Hydra —
teacher that knows the grammar well; the phases below build toward that.

---

## Stack

**Vercel AI SDK (`ai`)** is the core in every phase. One surface for
what `@jah` needs, and it keeps the model-provider question out of each
phase's logic:

- **System prompt** — `@jah`'s standing instructions: who it is, the
  Strudel (later Hydra) grammar it must respect, the house style
  (confirm don't code-dump, teach don't lecture). Assembled per command
  from shared fragments.
- **Tools** — zod-typed functions the model can call mid-turn:
  `searchPatterns`, `validatePattern` (`@strudel/mini` round-trip),
  `lookupFunction`, `readCursorRegion`, `applyEdit`, … The SDK validates
  the model's arguments against the schema before the tool runs. **Each
  new capability `@jah` gains is a new tool, not a new command.**
- **The call/tool/call loop** — `generateText({ system, messages,
  tools, maxSteps })`; no hand-rolled agent loop.
- **Provider swap in one line** — `workers-ai-provider` (the `env.AI`
  binding) or `@ai-sdk/anthropic` (Claude). Either way,
- **every call goes through a Cloudflare AI Gateway** — logging, cost
  tracking + spend alerts, rate limiting, prompt caching, as config not
  code, and it all survives a provider swap. This is the credit-control
  primitive; see the bucket-list doc.

**Provider is a real decision, not a default.** Workers AI keeps
everything inside Cloudflare with no API key, but the small open models
don't know Strudel/Hydra grammar well — and `@jah` is meant to *teach*
it. Phase 1 ships behind the `ai` SDK + the gateway so the provider can
be switched without touching any phase's logic. A grammar-accuracy
spike (does the model produce valid Strudel more than ~half the time?)
decides it before phases 4–5 commit to model-authored writes.

**Grammar knowledge is layered**: the system prompt (the rules),
**retrieval** over `content/docs/**` (Vectorize or AutoRAG — the docs
corpus, separate from the 46-pattern catalog), and **tools**
(`validatePattern`, `lookupFunction`). Discussion quality in phase 1 is
capped until doc retrieval lands.

**Stateless now, an Agent later.** `@jah` is ephemeral this roadmap —
`generateText` called from the composition Durable Object / a server
route, no per-`@jah` memory. If `@jah` later needs to remember a user
across sessions, track a room's musical direction, or act on a
schedule, the **Cloudflare Agents SDK** wraps the same `ai`-SDK core in
its own Durable Object; the system prompt and tools carry over
unchanged, only the shell changes.

---

## 0. `add-oauth-signin`

GitHub as an identity provider, plus a minimal profile. Independent of
the AI work — it improves signup for JAM and the Pattern library — and
it removes the "emailed magic link is fine" assumption phase 1 rests
on. Google is a clean fast-follow on the same abstraction, not this
change.

**The session layer doesn't change.** `sessions`, `createSession`, the
`jaime_session` cookie, `getSessionUser` / `getCurrentUser` /
`requireUser` — untouched. OAuth only replaces *how you prove who you
are*, then joins the existing flow at `createSession`.

**Flow** (via `nuxt-auth-utils`' `defineOAuthGitHubEventHandler` —
handles the authorize URL, `state`/CSRF, PKCE where supported, token
exchange, and GitHub's private-primary-email dance):
`/auth/github` → GitHub → `/auth/github/callback` → `onSuccess`:
`findOrCreateUser` (match on `github_id`, fall back to email) → set
`status: confirmed` (the provider verified the identity) → `createSession`
→ set cookie → redirect. `nuxt-auth-utils`' own sealed-cookie session
is ignored; jaime's D1 session is authoritative.

**Schema (`0005`)** — `users` gains `avatar_url TEXT`,
`github_login TEXT`, `github_id INTEGER UNIQUE`. `shared/user.ts`
`User` gains `avatarUrl?`.

**Account linking: match on verified email.** One `users` row per
email; any provider that verifies that email (or a magic link to it)
signs into the same account. `github_id` is the primary match key
(logins change, ids don't), email the fallback. No separate
`identities` table — fine at jaime's scale; recorded as a decision, not
an accident.

**Profile UX**:
- **Screen name** = the *existing* `users.display_name` — the field
  JAM and the Composition Room already use for presence. OAuth seeds it
  from GitHub `name` (falling back to `login`) instead of the email
  local-part; it stays editable in `/account`.
- **Avatar** — `avatar_url` is a plain CDN URL
  (`avatars.githubusercontent.com/u/<id>?s=64`), rendered directly.
  `CompositionPresenceEntry` and `ChatMessage` gain `avatarUrl?`; JAM
  presence too. Anonymous / magic-link users with no avatar fall back
  to an initial. `@jah` gets a static asset avatar shown the same way
  (phase 1).
- "Continue with GitHub" on `/signup`, alongside the existing email
  field. **Magic link stays** as the fallback for people who won't
  OAuth.

**Secrets**: `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` via
`wrangler secret put` (jaime's first secrets — everything so far is
bindings/vars). One GitHub OAuth App, two callback URLs (localhost dev
+ `jaime.stream`).

**Testing**: unit — mock the provider profile, assert
`findOrCreateUser` + session + `status: confirmed`. e2e — the real
OAuth redirect can't run in CI, so an `OAUTH_E2E` flag (like
`AUTH_E2E`) short-circuits the callback with a canned profile; the
avatar + screen-name rendering in chat/presence *is* straightforwardly
e2e-testable.

---

## 1. `add-jah-chat`

Wires `@jah` into the room's existing `chat` message type as a
participant (per `proposal.md`: "Phase 7 adds the AI as another
participant in it" — no new UI surface). Handles **discussion** only.
Available regardless of pause state.

**Built on the `ai` SDK** (see Stack). Phase 1 is `generateText({
system, messages })` with the discussion system prompt and **no tools
yet**. Response is a single message (not streamed) with a "`@jah` is
typing…" indicator meanwhile — no protocol churn. Provider starts as
`workers-ai-provider` (the `env.AI` binding), **routed through an AI
Gateway** (`wrangler.jsonc` + a gateway id) so logging, rate limiting,
caching and spend alerts come for free and survive a later swap to
Claude.

**Routing**: reserved first words (`fix`, `edit`) after the mention are
checked server-side before any model call; anything else falls through
to discussion. No NLU classification needed — deliberately explicit
syntax over inferred intent, since a misrouted write attempt is a worse
failure mode than a misrouted no-op. `@jah` must be the first token;
case-insensitive.

**Access + credit control** — the non-negotiable slice of
[`99-bucket-list/ai-credits-and-access-control.md`](./99-bucket-list/ai-credits-and-access-control.md):
- The WS connection is authenticated (read `jaime_session` from the
  upgrade headers → `getSessionUser`). This is new plumbing — the
  Composition Room is anonymous today — and phase 3 needs it too, so
  it's its own first task.
- `@jah` replies only to a user with `ai_access` (a `users` flag,
  default off; an env list of GitHub logins auto-grants). A user
  without it gets "AI is invite-only right now", not silence.
- A per-user daily request cap **and** a global daily cap,
  server-enforced.
- A kill switch (`JAH_ENABLED` env var for phase 1).
- A per-call `ai_usage` record in D1 (user, room, model, tokens, cost
  estimate).
- One `@jah` request in flight per room (a lock) — also what phase 5's
  "serialize concurrent requests" needs.

**System prompt**: identity + house style + a hand-written ~2 KB
Strudel core-function cheatsheet always in context, so phase-1
discussion isn't "generic LLM that's heard of Strudel" before doc
retrieval (phase 2+) lands.

**Testing**: unit-test with a mock model (`ai`'s `MockLanguageModelV1`),
no real inference. e2e — a `JAH_E2E` flag swaps in a canned response;
assert only that a message attributed to `@jah` (with its avatar)
appears for an allowlisted user, that a signed-in non-allowlisted user
gets the invite-only reply, and that an anonymous message triggers
nothing. Never assert on model content.

---

## 2. `add-jah-pattern-awareness`

Ships as a **`searchPatterns` tool** (zod-typed: `{ query, tags? }`)
the model calls when a question — or a later edit — would benefit from a
real catalog example. Adds the first tool to the phase-1 `generateText`
call.

**Retrieval: keyword/tag first.** Search `PATTERNS_DB` reusing the
Pattern library's existing browse/filter logic — 46 patterns, keyword
is good enough, and it ships fastest. **Semantic retrieval** (Workers
AI `@cf/baai/bge-*` embeddings → Vectorize, or the managed **AutoRAG**
layer — types already generated into `worker-configuration.d.ts`,
unused) is an **explicit follow-up**, done when tag coverage starts
missing things a description would have caught — not built now.

**Doc retrieval is separate.** `@jah`-as-teacher needs retrieval over
`content/docs/**` (Strudel + Hydra grammar and guides), a `lookupDocs`
/ `lookupFunction` tool on the same Vectorize/AutoRAG infrastructure.
Noted here; scheduled after the write phases, since discussion works
without it and the write phases don't.

**Testing**: a question with an obvious curated-pattern answer makes
the model call `searchPatterns` and cite a real pattern id, not an
invented one; assert on the tool call + a valid id, not on prose.

---

## 3. `add-jah-room-pause`

Pausing **silences the room**, not just an edit-lock.

**What pausing does, together**:
- Drops the `EditorView.editable` compartment for every editor (same
  mechanism decision 4 in `design.md` already uses for the
  editor/viewer role split — this adds a room-wide condition on top:
  `editable = isEditorRole && !roomPaused`).
- Broadcasts `stop` to everyone immediately, reusing the existing
  eval/stop broadcast from decision 5 — server-initiated instead of a
  human hitting Ctrl-`.`.
- Blocks new `eval`/`play` messages from clients for the duration —
  same drop pattern the DO already uses for viewer `y-update` frames,
  applied to a second message type.

**Resuming doesn't auto-play.** Consistent with "evaluation stays
explicit" — lifting the pause makes editing/evaluation possible again,
it doesn't re-trigger playback. Someone hits evaluate when ready.

**Naming**: this is bigger than "editing" — call the room state
`paused`/`frozen` rather than `set_editing`, since it's "is this room
live" not an editing-specific flag. New protocol message,
e.g. `{ t: 'set_paused', room, paused }`.

**Auth**: only a signed-in user can toggle it, either direction — using
the authenticated-WS-connection plumbing from phase 1. (`ai_access` is
not required to pause; any account can.)

**Testing**: pool-workers — pausing drops all `y-update` and `eval`
frames from clients; resuming restores editability but does not
restart playback; toggling is rejected from a non-authenticated
connection.

---

## 4. `add-jah-fix`

**Diagnose** (anytime, no pause needed): explains what's wrong with the
pattern, doesn't touch the document. Per decision 5, eval errors are
local to each client — the server never sees them — so the `@jah fix`
`chat` message carries `{ errorText, evaluatedCode }` attached by the
requesting client; `@jah` has no other way to know something's broken.
If nothing has been evaluated since the last edit (no error exists),
`@jah` replies "evaluate first so I can see the error" rather than
guessing.

**Apply** (room paused only): an **`applyEdit` tool** the model calls
with `{ from, to, replacement }` — a **targeted patch** to the erroring
region, not a whole-document replace. Pausing removes the concurrent-edit
risk entirely (nothing else can move underneath it), so a plain offset
is safe here — no `Y.RelativePosition` dance needed, unlike a live-room
scenario. Still worth avoiding a full `setCode()`-style overwrite even
though it'd technically be safe now: a targeted patch preserves
everything else in the doc and keeps undo sane (undo reverts the fix,
not the whole file). The tool runs the replacement through
`validatePattern` before it lands.

**Attribution/undo**: applies under the *requesting user's* Yjs
origin, not a separate AI origin — their own `undoManager` covers it
for free. Can still be visually marked as AI-generated (a decoration,
or attribution text) without a separate origin.

**Testing**: e2e — broken pattern, `@jah fix` while live gets a
diagnosis with no doc change; pause, `@jah fix` again applies a patch
that's isolated to the broken region; the requesting user's Ctrl-Z
undoes just the patch.

---

## 5. `add-jah-edit`

Cursor-anchored insert, e.g. cursor at the end of a pattern, `@jah edit
add echo and random transpose` → something like `.delay(...)` +
`.transpose(irand(...))` chained on. Open-ended instructions ("make
this livelier", "darker") land here too. Only available paused — same
"plain offset is safe once nothing else can move it" reasoning as Fix's
apply step. Reuses `add-jah-fix`'s `applyEdit` tool.

**Locally aware generation**: the server can't read Yjs awareness
(relayed opaquely, decision 3), so the `@jah edit` `chat` message
carries `{ cursorOffset, surroundingCode }` attached by the client —
the same client-attaches-context pattern as Fix's `errorText`. The
model needs the code immediately around the cursor, not just the whole
document, because the instruction only makes sense relative to what's
already chained there.

**Validated before landing**: `applyEdit` round-trips the replacement
through `validatePattern` (`@strudel/mini` — the same check every
generated pattern gets elsewhere in this project) before it applies.

**Confirmation, not a code dump**: chat responds with something like
"added echo + random transpose after your pattern" — the result is in
the document already, not something to copy from the chat.

**Concurrent requests are serialized.** Two `@jah edit`/`@jah fix`
requests in the same paused window queue rather than run in parallel —
one at a time, in order received. Simpler to reason about than
deciding per-case whether independently-landed results still make
sense together.

**Testing**: e2e — edit while live is rejected/ignored with a message
explaining the room needs to be paused; edit while paused lands
correctly at the cursor and passes validation; a deliberately malformed
instruction doesn't corrupt the document (validation catches it, no
write happens).

---

## Next roadmap — not this one

### `add-jah-melody-tool`

Deferred. Builds on the MIDI-to-mininotation pipeline sketched
separately (source → note-event IR → deterministic quantizer → LLM
refinement → `@strudel/mini` validation), exposed as a **`melodyFromMidi`
tool** that feeds `add-jah-edit`'s `applyEdit` write path — e.g.
dropping a MIDI file into the chat alongside an edit instruction, rather
than typing the pattern by hand. Same pause requirement, same
validation, same confirmation-not-dump response. The multi-second
pipeline is a good candidate to run as a Cloudflare **Workflow**
(durable steps, retries) rather than inline in the request.

Waits on this roadmap's `add-jah-edit` write path being solid, and on
the MIDI pipeline design being written down. Testing fixtures already
exist: the sample MIDI files from the earlier Java prototype
(`in_blue.mid`, `interstellar.mid`, `azul.mid`, `shape.mid`) have known
characteristics documented alongside them — reuse rather than inventing
new fixtures.