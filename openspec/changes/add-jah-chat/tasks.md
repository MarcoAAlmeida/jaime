## 1. Dependencies + config

- [x] 1.1 `npm i ai workers-ai-provider`.
- [x] 1.2 `wrangler.jsonc` — add the `ai` binding (`env.AI`); add
      `AI_GATEWAY_ID` and `JAH_ENABLED` vars (`JAH_ENABLED` absent —
      default disabled, per design decision 3).
- [x] 1.3 `.dev.vars` — add `JAH_E2E=1` (mirrors `AUTH_E2E`/
      `OAUTH_E2E`); `JAH_ENABLED` is not needed locally since the kill
      switch check itself also accepts `JAH_E2E` (design decision 3).
- [x] 1.4 `public/jah-avatar.svg` — a small static avatar asset for
      `@jah`'s chat messages.

## 2. Routing + prompt (pure, unit-tested)

- [x] 2.1 `server/jah/route.ts` — `classifyMention(text): { addressed:
      boolean, kind: 'discussion' | 'fix' | 'edit' }` per design
      decision 6: first token `@jah` (case-insensitive) required for
      `addressed`; next token `fix`/`edit` (case-insensitive) sets
      `kind`, else `'discussion'`.
- [x] 2.2 Unit tests: not addressed (no mention, mid-message mention);
      addressed + discussion; addressed + fix; addressed + edit;
      case-insensitivity for both the mention and the keyword.
      (Also found and fixed, as a prerequisite: `toReconcileSql` in
      `scripts/lib/patterns-manifest.mjs` embedded a raw newline for
      any multi-line pattern code, corrupting the vitest test-DB seed
      for the *entire* suite — pre-existing, unrelated to `@jah`. Fixed
      via a hex-blob literal for multi-line values, with regression
      tests in `patterns-manifest.test.mjs`.)
- [x] 2.3 `server/jah/prompt.ts` — the system prompt constant: `@jah`'s
      identity, house style (confirm don't code-dump, teach don't
      lecture), and a hand-written ~2 KB Strudel core-function
      cheatsheet.

## 3. Access, caps, and usage recording

- [x] 3.1 `server/jah/caps.ts` — `underCaps(db, userId, { perUser,
      global }): Promise<{ ok: boolean, reason?: 'user' | 'global' }>`
      per design decision 2: `COUNT(*) FROM ai_usage` since UTC day
      start, scoped by `user_id` then unscoped.
- [x] 3.2 `server/auth/aiUsage.ts` — add `recordUsage(db, { userId,
      githubLogin, roomId, model, promptTokens, completionTokens,
      costEstimateUsd })` (the write side `add-admin-console` left
      for this change).
- [x] 3.3 Pool-workers tests: `underCaps` — under both caps → ok; at
      the per-user cap → `reason: 'user'`; at the global cap (from a
      different user) → `reason: 'global'`; resets past UTC midnight.
      `recordUsage` — a row lands and is readable via
      `listRecentUsage`.

## 4. The model call seam

- [x] 4.1 `server/jah/reply.ts` — `generateJahReply(env, messages):
      Promise<{ text, model, promptTokens, completionTokens }>` per
      design decision 5. `JAH_E2E` set → canned reply, no `env.AI`
      call. Otherwise → `workers-ai-provider` + `ai`'s `generateText`
      against `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, routed
      through `AI_GATEWAY_ID`.
      (`ai`@7 renamed the older `CoreMessage` type from design.md to
      `ModelMessage`, and its usage object to `inputTokens`/
      `outputTokens` — mapped to our own `promptTokens`/
      `completionTokens` return fields, confirmed against the
      installed package's own .d.ts rather than assumed.)
- [x] 4.2 Unit test: with `JAH_E2E` set, `generateJahReply` returns the
      canned reply and never touches `env.AI`.

## 5. Composition Room integration

- [x] 5.1 `server/routes/composition.ts` — presence map value grows to
      `{ name, role, awarenessId?, avatarUrl?, userId?, aiAccess?,
      githubLogin? }`, populated once in the `join` handler via
      `accountFor(peer)` (extend it to return the fuller shape) per
      design decision 1.
- [x] 5.2 `chat` handler — before broadcasting a `@jah`-addressed
      message as usual, run: `classifyMention` → if addressed,
      gate in order: kill switch (`JAH_ENABLED === '1' || !!JAH_E2E` —
      see design decision 3's implementation note) → signed-in →
      `hasAiAccess()` → `underCaps` → the room's `jahBusy` lock →
      `fix`/`edit` decline vs. discussion. Every decline path replies
      with a fixed explanatory `chat` message from `@jah`; only a real
      discussion call sets `jahBusy`, sends `jah_typing: true`, calls
      `generateJahReply`, records usage, broadcasts the reply, clears
      `jahBusy`.
      (`recordUsage`'s `costEstimateUsd` now comes from
      `generateJahReply` itself — see design decision 5's update.)
- [x] 5.3 `shared/compositionProtocol.ts` — add `{ t: 'jah_typing',
      typing: boolean }` to `CompositionServerMessage`.
- [x] 5.4 `app/pages/app/composition/[id].vue` — render the typing
      signal (e.g. a small "`@jah` is thinking…" line) and `@jah`'s
      messages through the existing `UserAvatar`-based chat rendering
      (no new component needed — `@jah`'s `ChatMessage.avatarUrl` is
      `/jah-avatar.svg`).
      (Added a `jahTyping` event to `compositionProvider.ts`'s `Events`
      interface and its `jah_typing` dispatch case, mirroring the
      other server-message handlers there.)
- [x] 5.5 Tab order + default tab (design decision 9): reorder the
      tabs array to `chat, composition, ascii`; change `activeTab`'s
      initial value from `'composition'` to `'chat'`.
      (Updated e2e fallout: `joinRoom`/similar helpers in
      composition.spec.ts, mobile-rooms.spec.ts, ascii-panel.spec.ts,
      and oauth.spec.ts now explicitly land on/switch to whichever tab
      each test actually needs, since Composition is no longer the
      implicit default. composition.spec.ts already had a viewport-
      agnostic `openTab` helper — reused it rather than hardcoding a
      testid.)
- [x] 5.6 `@jah` welcome message (design decision 10): when a room's
      chat is empty at creation, insert a static, hardcoded `@jah`
      chat message (introducing itself and how to mention it) as the
      first entry — no model call, no usage record, unaffected by
      `JAH_ENABLED`/`hasAiAccess()`/caps. Reuses the existing
      "is this a fresh room" check the document seeding already makes.
      (Ripple: fixed pre-existing tests whose assertions assumed a
      just-emptied room's chat comes back literally empty —
      `test/composition.test.ts` and 3 spots in
      `e2e/composition.spec.ts` now expect/filter for `@jah`'s
      welcome instead. Also discovered along the way: pool-workers
      tests using `SELF.fetch` run against the *bundled*
      `.output/server/index.mjs`, not live source — `npm run build`
      is required before they reflect server-route changes; the 4
      `server/jah/*` unit-test files were unaffected since they import
      those modules directly.)

## 6. Tests + ship

- [x] 6.1 Pool-workers WS tests (extend `test/composition.test.ts` or a
      sibling): kill switch off → silent; anonymous → silent; signed-in
      no access → invite-only reply, no usage row; over cap → capped
      reply, no usage row; `fix`/`edit` → not-yet-supported reply;
      a normal discussion request (with `JAH_E2E`) → reply attributed
      to `@jah` with its avatar, one `ai_usage` row written; a second
      request while one is in flight in the same room → declined, not
      interleaved; two different rooms don't block each other.
      (New sibling `test/jah-chat.test.ts`, 7 tests. "Kill switch off"
      is NOT exercised here — `.dev.vars`' `JAH_E2E=1` is loaded into
      every pool-workers test in this project, so `JAH_ENABLED` is
      always effectively on; that one-line branch is unit-tested in
      isolation via `isJahEnabled`, see task 2.2's note. Discovered the
      instant `JAH_E2E` stub made the busy-lock/typing-signal scenario
      unobservable — a real reply always beat a deliberately-racing
      second message to the client — fixed by giving the stub a 200ms
      artificial delay, see design.md decision 5.)
- [x] 6.2 e2e `e2e/jah-chat.spec.ts` (`JAH_E2E`): an allowlisted signed-in
      user's `@jah` message gets a reply visible to everyone in the
      room with `@jah`'s avatar; a non-allowlisted signed-in user gets
      the invite-only reply; an anonymous user's `@jah`-addressed
      message gets no reply; a brand-new room's chat already shows
      `@jah`'s welcome (even for an anonymous visitor, even with
      `JAH_ENABLED` unset) and a second joiner does not see it posted
      again; a new room opens on the Chat tab by default. 4 tests, all
      passing.
      (Ripple: two pre-existing composition.spec.ts tests asserted
      `toBeVisible()` on a chat message for a peer that hadn't
      switched to the Chat tab itself — always coincidentally true
      before, since Chat is now not everyone's active tab by default.
      Fixed to `toHaveCount()`, matching their actual intent
      [message delivery, not tab state].)
- [x] 6.3 `nuxt typecheck`, `vitest run`, `playwright test` green.
      (Full suites: 139/139 vitest across 15 files; 32/32 e2e across
      composition/mobile-rooms/pattern-loading/oauth/ascii-panel/
      jah-chat.)
- [x] 6.4 `openspec validate add-jah-chat --strict`.
- [x] 6.5 Operator: create the Cloudflare AI Gateway, set
      `AI_GATEWAY_ID`; `npm run deploy`. `@jah` stays silent
      (`JAH_ENABLED` unset) until the operator explicitly sets it and
      redeploys.
      (Gateway `jaime-jah` created via the Cloudflare API — Marco
      walked through the dashboard's "Authenticated Gateway" and
      "Workers AI Billing" prompts; logging on, caching off (`cache_ttl:
      0`), authentication off since the gateway is only ever reached
      via the `env.AI` binding, never a public REST call. Deployed:
      version `c4c52a88-23ae-4584-8bf7-22fd0ba498ce`. `env.AI` +
      `AI_GATEWAY_ID` are live in the bindings list; `JAH_ENABLED` is
      correctly absent.)
- [x] 6.6 Once `JAH_ENABLED=1` is live: the operator sends a real
      `@jah` message on `jaime.stream` and confirms a reply appears,
      an `ai_usage` row lands and shows in `/admin`.
      (Deployed version `84135593-9797-4342-b07b-bfe93cb21666`. Marco
      signed in via real GitHub OAuth, sent "@jah what does the
      .euclid function do in Strudel?" in a live room, got a real,
      accurate reply attributed to `@jah` with its avatar. `/admin`
      shows the usage row: MarcoAAlmeida,
      `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, 755/50 tokens,
      $0.0003 estimated cost.)
- [ ] 6.7 Sync the `jah-chat` and `composition-room` deltas; archive
      the change.
- [ ] 6.8 `docs/04-roadmap/index.md` — mark Phase 1 shipped; note
      Phase 2 (`add-jah-pattern-awareness`) is next.
