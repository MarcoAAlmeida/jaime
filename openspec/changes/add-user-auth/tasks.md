## 1. Infra: D1 schema, email, bindings

- [x] 1.1 `send_email` binding `EMAIL` added to `wrangler.jsonc`;
      `compatibility_date` bumped to `2025-07-15` (matches nuxt.config);
      `wrangler types` → `EMAIL: SendEmail` in the ambient `Env`.
      Email Sending onboarded for `jaime.stream` via the dashboard
      (OAuth/MCP tokens lack the email scope) — Status: Enabled, DNS
      (SPF + DKIM): Configured, reputation Healthy. Sends from the apex
      (`noreply@jaime.stream`), no subdomain.
- [x] 1.2 `migrations/patterns/0003_users_and_sessions.sql` — `users`,
      `auth_tokens`, `sessions` + indexes per design decision 3.
      `db:migrate:local` applies cleanly (7 statements).
- [x] 1.3 `vitest.config.ts`'s `readD1Migrations('migrations/patterns')`
      + `test/apply-migrations.ts` pick up `0003` with no change (reads
      the whole dir). Confirmed by 2.6's tests running against the new
      tables.

## 2. Server auth core (`server/auth/`)

- [x] 2.1 `server/auth/tokens.ts` — SHA-256 hash helper (`crypto.subtle`),
      `issueToken(db, userId)` (32 random bytes → raw + hash row, 15-min
      expiry, deletes prior unused token for the user), `consumeToken(db,
      raw)` (match unused + unexpired, set `used_at`, return `userId` or
      null)
- [x] 2.2 `server/auth/users.ts` — `findOrCreateUser(db, email,
      displayName?)`, `getUser(db, id)`, `confirmUser(db, id)`,
      `updateDisplayName(db, id, name)`, `deleteUser(db, id)` (cascades
      sessions + tokens), `email` normalisation (trim + lowercase),
      60-second `last_auth_request_at` throttle check
- [x] 2.3 `server/auth/sessions.ts` — `createSession(db, userId)`,
      `getSessionUser(db, sessionId)` (join, expiry check, sliding
      `last_seen_at` / `expires_at` bump), `deleteSession(db, id)`,
      `deleteUserSessions(db, userId)`
- [x] 2.4 `server/utils/auth.ts` (auto-imported) — `usePatternsDb`-style
      binding access + `getCurrentUser(event)` (reads `jaime_session`
      cookie → `getSessionUser`), `setSessionCookie` / `clearSessionCookie`
- [x] 2.5 `server/auth/email.ts` — `sendSignInEmail(env, email, link)`
      via the `EMAIL` binding (html + text, honest copy); 503-style
      error if the binding is missing; a test seam so unit/e2e can
      capture the link instead of sending
- [x] 2.6 Unit tests (pool-workers, local D1): token issue/consume/
      expire/supersede/used; session create/lookup/slide/expire/delete;
      `findOrCreateUser` no-dupe + normalisation; throttle; delete
      cascade

## 3. Auth API routes (`server/api/auth/`)

- [x] 3.1 `request.post.ts` — `{ email, displayName? }` → validate,
      find-or-create, throttle, issue token, send email; always
      `{ ok: true }` (no account enumeration)
- [x] 3.2 `callback` page route `app/pages/auth/callback.vue` (or a
      server route that redirects) — consume the `token` query param;
      on success confirm the user if pending, create a session + set
      the cookie, redirect to a same-origin `next` or `/`; on failure
      render a "link no longer valid — request a new one" page
- [x] 3.3 `me.get.ts` — `{ user }` or `{ user: null }`; `me.patch.ts` —
      update display name (auth required)
- [x] 3.4 `signout.post.ts` — delete the session, clear the cookie
- [x] 3.5 `account.delete.ts` — delete the current user (cascade),
      clear the cookie
- [x] 3.6 Route tests (`SELF.fetch`, email stubbed): request →
      captured link → callback sets a cookie → `/api/auth/me` reports
      the user; used/expired link rejected; enumeration-safe response;
      signout; delete then a fresh request makes a new pending user

## 4. Client auth state

- [x] 4.1 `app/composables/useAuth.ts` + `app/plugins/auth.server.ts` /
      client hydration — `useState<User|null>('auth-user')` filled
      server-side from `getCurrentUser(useRequestEvent())`, refreshed
      client-side via `/api/auth/me` after sign-in/out; expose `user`,
      `isSignedIn`, `signOut()`, `requestLink(email, name?)`
- [x] 4.2 `app/composables/useDisplayName.ts` — return the account name
      when signed in (else sessionStorage as today); the room name-gate
      shows only when neither an account nor a session name exists
- [x] 4.3 e2e helper updates: `createRoom` / `joinRoomById` still work
      for anonymous users unchanged

## 5. Pages & shells

- [x] 5.1 `app/pages/signup.vue` — real: one email field (+ prefilled
      name field when the client has a session name and the address
      looks new); submit → `requestLink` → "check your email for a
      sign-in link"; drop the "coming soon" alert; honour `?next=`
- [x] 5.2 `app/pages/account.vue` (auth-required) — email shown,
      editable display name, Sign out, Delete account (with confirm)
- [x] 5.3 `layouts/dashboard.vue`, `layouts/docs.vue`, `layouts/landing.vue`
      — a signed-in indicator (name → `/account`) or a "Sign in" link
- [x] 5.4 e2e: request a link (captured via the test seam) → open the
      callback → signed in; still signed in after a `context` reload;
      sign out returns to anonymous; delete account
      (`e2e/auth.spec.ts`, 5 tests)

## 6. Gated docs page

- [x] 6.1 `content.config.ts` `docs` schema — add
      `authRequired: z.boolean().optional()`
- [x] 6.2 `content/docs/9.behind-the-scenes.md` with `authRequired: true`
      — real content on how jaime is built (stack + the OpenSpec
      spec→impl→archive loop)
- [x] 6.3 `app/pages/docs/[...slug].vue` — when the page is
      `authRequired` and there is no current user, null the `body` in
      the data fetch (server + client) and render a "Sign in to read
      this" panel with a `/signup?next=<path>` button instead of
      `<ContentRenderer>`
- [x] 6.4 `layouts/docs.vue` nav — mark `authRequired` sections with a
      lock icon; they stay listed
- [x] 6.5 e2e: signed out → the page is listed (locked) and shows the
      explainer, and its prose is absent from the SSR HTML; signed in →
      the page renders (`e2e/auth.spec.ts` "gated doc")

## 7. Domain-model doc

- [x] 7.1 `docs/05-domain-model/index.md` — revise decision 3 (token is
      a repeatable single-use `AuthToken` with expiry + supersede, not a
      one-time confirmation field) and decision 6 (`User` gains nothing
      new but the token moves out; add a `Session` entity and an
      `AuthToken` entity to the Catalog context)

## 8. Verification + deploy

- [x] 8.1 `nuxt typecheck` (0 errors), `vitest run` (77/77),
      `playwright test` (19/19) all green.
- [x] 8.2 Verified against `wrangler dev`: anon SSR of the gated doc
      carries none of its body phrases, signed-in carries them; the
      request → emailed/dev link → callback → cookie → `/api/auth/me`
      → PATCH name → `/account` → signout → delete flow all work; the
      remaining spec scenarios are covered by `e2e/auth.spec.ts`.
- [x] 8.3 Deployed via `npm run deploy` (migration 0003 applied to
      remote `jaime-patterns`, version f175c77a). Real end-to-end
      sign-in on `https://jaime.stream` confirmed: the email arrived
      from `noreply@jaime.stream`, the link signed the account in, the
      session survived a full browser restart, `/account` and the gated
      doc both render.
