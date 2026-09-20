## Context

See proposal.md — Why. `server/routes/composition.ts` already
authenticates the WS connection (`accountFor(peer)`, added in
`add-oauth-signin`) but only extracts `{ userId, avatarUrl }`, cached
nowhere per-connection — it's re-resolved into `room.presence` at
`join` and never read again. `hasAiAccess()`, `AI_ACCESS_LOGINS`, and
the `ai_usage` table (write-side unused) already exist from
`add-admin-console`. `worker-configuration.d.ts` already has the `Ai`
type generated; no `env.AI` binding is wired up yet. Composition Room's
`chat` message type (`{ t: 'chat', text }` in, `{ t: 'chat', message }`
out) is the only surface — see `shared/compositionProtocol.ts`.

## Goals / Non-Goals

**Goals:**

- `@jah` answers a discussion-only mention in the Composition Room
  chat, gated by access, caps, and a kill switch, with every real call
  recorded.
- Every model call goes through a Cloudflare AI Gateway from the first
  call, per the bucket-list's "do this from the first `@jah` call".

**Non-Goals (later `@jah` phases):**
- Tools (`searchPatterns`, `validatePattern`, …), doc retrieval.
- Any UI for the caps/kill switch — env vars, edited and redeployed,
  are enough at Marco-only scale (matches the bucket-list's "now" tier).
- A Durable-Object-stored kill switch — env var is the roadmap's
  explicit phase-1 choice; DO-stored is a noted future improvement.

## Decisions

### 1. Per-connection account, cached once at `join`

The composition room's presence map value grows from
`{ name, role, awarenessId?, avatarUrl? }` to also carry
`{ userId?, aiAccess?, githubLogin? }`, resolved once via
`accountFor(peer)` at `join` (not re-queried per chat message). The
`chat` handler reads this cached account to decide whether the sender
even *could* get an `@jah` reply.

**Trade-off**: if the operator grants access mid-session, the change is
only picked up on that connection's next `join` (i.e. a reconnect/room
rejoin), not the current open tab. Acceptable — operator toggles are
rare and manual, and "rejoin" is a reasonable workaround; re-querying
D1 on every chat message for a flag that almost never changes isn't
worth the added latency and load.

### 2. Caps are `ai_usage` `COUNT(*)` queries, no new schema

Per-user cap: `COUNT(*) FROM ai_usage WHERE user_id = ? AND created_at
>= <UTC day start>`. Global cap: the same without the `user_id` filter.
No new counter table — `ai_usage` (already schema'd in
`add-admin-console`) is both the audit trail and the cap source of
truth, so there's exactly one place spend is tracked. Revisit only if
volume ever makes the count expensive (an index on `created_at`
already exists).

### 3. Kill switch: `JAH_ENABLED` env var, must be exactly `'1'`

Matches the existing `AUTH_E2E` / `OAUTH_E2E` truthy-string convention.
Unset (the default) = disabled, so a fresh deploy never spends until
Marco explicitly sets it. Flipping it means editing `wrangler.jsonc`
and redeploying — the roadmap accepts this for phase 1; a
Durable-Object-stored flag (togglable from `/admin` with no redeploy)
is the documented next step, not built here.

**Caught during implementation**: the chat handler's gate order (task
5.2) checks the kill switch *before* ever calling `generateJahReply`,
so `JAH_E2E` alone — which only stubs that function — would never be
reached locally, since `JAH_ENABLED` is absent in dev/e2e too. Fixed
to match the `AUTH_E2E`/`OAUTH_E2E` precedent of "one flag fully
unlocks the feature under test": the kill-switch check is
`env.JAH_ENABLED === '1' || !!env.JAH_E2E`, so setting `JAH_E2E=1` in
`.dev.vars` is sufficient on its own — no second flag needed to
exercise the discussion path in dev or e2e.

Also extracted as `isJahEnabled(env)` in `server/jah/route.ts` rather
than left inline in the chat handler: `.dev.vars`' `JAH_E2E=1` is
loaded into every pool-workers test in this project (there's no
per-test binding override), so the "kill switch off" scenario can't be
exercised through a real WebSocket connection at all — a plain unit
test over this one-line pure function is the only place that path is
actually covered.

### 4. One in-flight request per room: decline, don't queue

`CompositionRoom` gains `jahBusy: boolean` (in-memory, same lifetime as
`chat` — never persisted, reset on room reload). A second
`@jah`-addressed message while busy gets an immediate "still working on
the last one, one sec" reply rather than being queued. Simpler than a
queue, and avoids unbounded backlog if someone spams `@jah`; a real
queue is a reasonable future improvement if declines turn out to be
annoying in practice.

### 5. The model call is one seam: `server/jah/reply.ts`

```ts
generateJahReply(env: Env, messages: ModelMessage[]):
  Promise<{ text: string, model: string, promptTokens: number, completionTokens: number, costEstimateUsd: number }>
```

(`ai`@7 renamed the SDK's `CoreMessage` type to `ModelMessage`, and its
usage object to `inputTokens`/`outputTokens` — confirmed against the
installed package, mapped onto our own field names below.)

`costEstimateUsd` is computed here, not by the caller: Workers AI's
published per-token rate for MODEL (`$0.293`/`$2.253` per M input/
output tokens) times the actual token counts — an estimate for the
`ai_usage` audit trail, not a billing-accurate figure. `JAH_E2E`
returns `0` for it, same as its token counts.

- **`JAH_E2E` set** → returns a fixed canned reply after a short
  (200ms) artificial delay, no `env.AI` call. Tests (unit and e2e)
  never spend real money or need Workers AI access from local dev,
  same posture as `OAUTH_E2E`. The delay is deliberate, not
  incidental: an instant stub made both `jah_typing` and the
  `jahBusy` lock (decision 4) unobservable in a pool-workers
  integration test — the reply was already broadcast by the time a
  second, deliberately-racing request's message even reached the
  server, so "busy" never triggered. 200ms is enough margin for a
  same-process test to land a second message inside that window,
  without meaningfully slowing e2e runs.
- **Otherwise** → `workers-ai-provider`'s `createWorkersAI({ binding:
  env.AI })` + the `ai` SDK's `generateText({ model, system, messages
  })`, routed through the AI Gateway named by `AI_GATEWAY_ID`.
- **Model**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` to start — the
  largest general instruct model Workers AI offers at reasonable cost.
  Not a permanent choice: the roadmap's grammar-accuracy spike (before
  phases 4–5 commit to model-authored writes) may swap it, and the
  provider itself may later swap to Claude — both are one-line changes
  behind this seam.

### 6a. Each `@jah` mention is answered statelessly — no chat memory

`generateJahReply`'s `messages` is always a single user turn: the
triggering message's text (minus the `@jah` mention itself), wrapped
with the system prompt. No prior room chat — human or `@jah`'s own
earlier replies — is included. A follow-up like "what about the kick
drum" gets no benefit from an earlier answer in the same room; the
person has to restate context each time. This matches the phase's
"discussion only, no doc retrieval" scope — remembering a
conversation is a bigger feature (deciding how much history, what
counts as stale, whether it should include the document once that
lands too) better designed alongside a later phase, not bolted on now.

### 6. Routing is a pure, unit-testable function

`classifyMention(text): { addressed: boolean, rest: string }` —
first-token `@jah` check (case-insensitive). Called before any account,
cap, or model work, so a message that isn't addressed to `@jah` costs
nothing beyond a string check.

### 7. `@jah`'s avatar is a static asset, not a profile picture

`public/jah-avatar.svg`, referenced by a fixed same-origin path
constant. Never passed through `sanitizeAvatarUrl`'s
`avatars.githubusercontent.com` allowlist — that check exists for
*user-supplied* provider avatars; `@jah`'s avatar is a server constant,
already trusted.

### 8. Typing signal: one new server→client message, not streaming

`{ t: 'jah_typing', typing: boolean }` added to
`CompositionServerMessage`. Sent `true` right after a request passes
every gate and the model call starts, `false` (or simply superseded by
the `chat` message) once the reply lands or is declined. Declines
happen synchronously enough that they may not need the typing flag at
all — only a real model call is slow enough to need it; recorded here
as an implementation detail, not a spec requirement change.

### 9. Chat is the default tab, and comes first

The interface already moved Chat to its own tab (Composition,
Chat, ASCII Art) since this roadmap phase was first scoped. With
`@jah` living in chat, defaulting every new entrant to Composition
would bury both the welcome message and any live conversation behind
an extra click. Tab order changes to Chat, Composition, ASCII Art, and
`activeTab` initializes to `'chat'` instead of `'composition'` — a
UI-only change, independent of the model/access/cost machinery.

### 10. The welcome message is static text, not a model call

`@jah`'s welcome is a hardcoded string (like `JAH_E2E`'s canned reply,
but always on, not test-only), inserted as chat's first entry when a
room's chat is empty — reusing the same "is this fresh?" check the
document seeding already does (`provider.text.length === 0` /
`chat.length === 0`, checked once at room creation), not a persisted
per-room flag. It bypasses `hasAiAccess()`, the kill switch, and the
caps entirely: it costs nothing, so none of the gating that protects
spend applies to it. This means it still appears even when
`JAH_ENABLED` is off — it is not "`@jah` replying," it is a static
product string that happens to be attributed to `@jah`.

### 11. AI Gateway: logging on, caching off

**Logging on** (default gateway behavior, prompt/response payload
included, not just metadata) — at Marco-only scale there's no privacy
policy to reconcile and seeing what people actually ask `@jah` is
useful for judging model quality and abuse. Revisit payload-off
(`cf-aig-collect-log-payload: false`, metadata only) if `@jah` ever
opens beyond the current allowlist.

**Caching off** (also default) and left off, not enabled: AI Gateway's
cache key is an exact hash of the full request body, with no semantic
matching. Since every `@jah` prompt is free-text chat, two requests are
almost never byte-identical, so caching would essentially never hit —
enabling it would add a settings knob with no realistic benefit here.

## Risks / Trade-offs

- **Stale cached access mid-session** (decision 1) → mitigation:
  reconnect/rejoin picks up a fresh grant; documented, not silent.
- **Kill switch needs a redeploy** (decision 3) → mitigation: it's the
  roadmap's accepted phase-1 posture; DO-stored is the known next step.
- **Decline-not-queue under load** (decision 4) → a very chatty room
  could see repeated declines; acceptable at current scale, revisit if
  real usage shows it's annoying.
- **`COUNT(*)` caps** (decision 2) → cheap at current volume; the
  existing `idx_ai_usage_created_at` index keeps the per-user query
  fast even as the table grows.
- **Model quality** → Workers AI's general model may produce shaky
  Strudel-specific answers; the system prompt's cheatsheet mitigates
  it, and the roadmap already schedules a grammar-accuracy spike before
  any phase that would have the model *write* code.
- **The welcome message shows even while `JAH_ENABLED` is off**
  (decision 10) → someone could mention `@jah` expecting a reply after
  reading its own welcome, and get silence or an invite-only decline
  instead. Acceptable: the welcome's own text should set that
  expectation (introduce `@jah`, not promise it's currently live), and
  this only matters pre-launch or if the switch is later turned off.

## Migration Plan

No schema migration — `ai_usage` and `users.ai_access` already exist
(`0006`). Steps:

1. `npm i ai workers-ai-provider`.
2. `wrangler.jsonc`: add the `ai` binding (`env.AI`); add `AI_GATEWAY_ID`
   and `JAH_ENABLED` vars (`JAH_ENABLED` **absent** by default).
3. **Operator, before this ships live**: create the AI Gateway in the
   Cloudflare dashboard (analogous to registering the GitHub OAuth App
   in `add-oauth-signin`) and set `AI_GATEWAY_ID`. Leave logging and
   caching at their defaults (logging on, caching off — decision 11);
   no settings change needed there.
4. `.dev.vars` gets `JAH_E2E=1` so local dev and e2e never call a real
   model.
5. Deploy. `@jah` stays silent everywhere (`JAH_ENABLED` unset) until
   the operator flips it on and redeploys.

**Rollback**: unset `JAH_ENABLED` (or redeploy the previous version) —
`@jah` goes silent immediately; nothing else in the room is affected.
