## Why

The `@jah` roadmap's Phase 1: give the Composition Room an AI
participant that can discuss the shared document, gated by everything
`add-oauth-signin` and `add-admin-console` already built —
authenticated WS connections, `hasAiAccess()`, and the `ai_usage`
table. Nothing upstream of this exists yet: no model call, no gateway,
no caps, no kill switch. This change is the first one that actually
spends money, so its access/credit controls are as load-bearing as the
feature itself.

## What Changes

- **`@jah` as a chat participant** in the Composition Room's existing
  `chat` message type — no new UI surface. A message starting with
  `@jah` (case-insensitive, first token) gets a reply from `@jah`,
  attributed like any other chat message, with its own avatar.
- **A one-time `@jah` welcome message.** A brand-new room's chat opens
  with a static, canned greeting from `@jah` as its first entry —
  introducing itself and how to mention it. Free (no model call, no
  usage record, no cap), and shown to everyone including anonymous,
  access-less visitors, since its job is discoverability, not
  answering a request.
- **Chat becomes the room's first and default tab.** Since Chat moved
  to its own tab, and `@jah` lives there, the tab order changes to
  Chat, Composition, ASCII Art, and every new entrant lands on Chat
  first (was Composition) — so the welcome message (and any live
  conversation) is the first thing anyone sees.
- **Discussion only.** `generateText({ system, messages })` via the
  Vercel AI SDK, **no tools**. Reserved keywords `fix` / `edit` right
  after the mention are recognized but explicitly not supported yet —
  `@jah` says so rather than answering as generic discussion (keeps the
  later `fix`/`edit` phases unambiguous once they land).
- **Provider**: Workers AI (`env.AI` binding), **every call routed
  through a Cloudflare AI Gateway** — logging, caching, rate limiting,
  spend alerts as config. Swappable to Claude later without touching
  this change's logic.
- **Access + credit control** (the non-negotiable slice of the
  bucket-list doc):
  - Gated on `hasAiAccess()` (from `add-admin-console`) — a user
    without it gets an "invite-only" reply, not silence; anonymous
    messages get no reply at all.
  - A per-user daily cap and a global daily cap (25 / 150, counted from
    `ai_usage`).
  - A `JAH_ENABLED` kill switch, **off by default** — a fresh deploy
    never spends until explicitly turned on.
  - One `@jah` request in flight per room (a lock).
  - Every call writes an `ai_usage` row (`recordUsage()` — the write
    side `add-admin-console` deferred here).
- **System prompt**: identity, house style, and a hand-written Strudel
  core-function cheatsheet, always in context.
- **A "`@jah` is typing…" signal** while a reply is in flight — one
  small addition to the composition WS protocol, not streaming.
- **`JAH_E2E`** (mirrors `AUTH_E2E` / `OAUTH_E2E`): swaps in a canned
  reply so tests never call a real model.

**Explicitly not in this change** (later `@jah` phases): the
`searchPatterns` tool, doc retrieval, pausing the room, `fix`/`edit`
actually applying anything, an admin surface for the caps/kill switch
(env vars are enough at Marco-only scale).

## Capabilities

### New Capabilities

- `jah-chat`: `@jah` as a discussion-only AI participant in the
  Composition Room chat — the mention/routing rule, access + credit
  gating (allowlist, caps, kill switch), the model call and its
  system prompt, and the usage record it writes.

### Modified Capabilities

- `composition-room`: "Ephemeral Room Chat" gains `@jah` as a possible
  message sender (with its own avatar) and the transient typing signal;
  the tab order and each new entrant's default active tab both change
  to put Chat first.

## Impact

- **New dependencies**: `ai`, `workers-ai-provider`.
- **New binding**: `env.AI` (Workers AI) in `wrangler.jsonc`.
- **New config**: `AI_GATEWAY_ID` var (the operator creates the AI
  Gateway in the Cloudflare dashboard first — analogous to the GitHub
  OAuth App in `add-oauth-signin`); `JAH_ENABLED` var, unset/`0` by
  default; `.dev.vars` gets `JAH_E2E=1`.
- **New code**: `server/jah/{prompt,route,caps,reply}.ts`;
  `server/auth/aiUsage.ts` gains `recordUsage()`;
  `public/jah-avatar.svg`.
- **Modified**: `server/routes/composition.ts` (chat handler gains the
  `@jah` branch; the cached per-connection account grows from
  `{ avatarUrl }` to `{ userId, name, avatarUrl, aiAccess,
  githubLogin }`); `shared/compositionProtocol.ts` (`jah_typing`
  server message).
- **Consumes**: `hasAiAccess()` and `ai_usage` from `add-admin-console`;
  the authenticated-WS-connection plumbing from `add-oauth-signin`.
- No change to JAM, the Pattern library, or anonymous use of any tool.
