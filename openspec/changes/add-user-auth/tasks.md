## 1. Infra: D1 schema, email, bindings

- [ ] 1.1 `wrangler email sending enable jaime.stream` (auto SPF/DKIM
      DNS); add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc`
      and bump `compatibility_date` to a 2025 date; `wrangler types`
- [ ] 1.2 `migrations/patterns/0003_users.sql` — `users`, `auth_tokens`,
      `sessions` tables + indexes per design.md decision 3; verify
      `db:migrate:local` applies cleanly
- [ ] 1.3 `wrangler d1 migrations` local + the vitest setup already
      applied via `readD1Migrations` pick up `0003` automatically —
      confirm the pool-workers tests see the new tables

## 2. Server auth core (`server/auth/`)

- [ ] 2.1 `server/auth/tokens.ts` — SHA-256 hash helper (`crypto.subtle`),
      `issueToken(db, userId)` (32 random bytes → raw + hash row, 15-min
      expiry, deletes prior unused token for the user), `consumeToken(db,
      raw)` (match unused + unexpired, set `used_at`, return `userId` or
      null)
- [ ] 2.2 `server/auth/users.ts` — `findOrCreateUser(db, email,
      displayName?)`, `getUser(db, id)`, `confirmUser(db, id)`,
      `updateDisplayName(db, id, name)`, `deleteUser(db, id)` (cascades
      sessions + tokens), `email` normalisation (trim + lowercase),
      60-second `last_auth_request_at` throttle check
- [ ] 2.3 `server/auth/sessions.ts` — `createSession(db, userId)`,
      `getSessionUser(db, sessionId)` (join, expiry check, sliding
      `last_seen_at` / `expires_at` bump), `deleteSession(db, id)`,
      `deleteUserSessions(db, userId)`
- [ ] 2.4 `server/utils/auth.ts` (auto-imported) — `usePatternsDb`-style
      binding access + `getCurrentUser(event)` (reads `jaime_session`
      cookie → `getSessionUser`), `setSessionCookie` / `clearSessionCookie`
- [ ] 2.5 `server/auth/email.ts` — `sendSignInEmail(env, email, link)`
      via the `EMAIL` binding (html + text, honest copy); 503-style
      error if the binding is missing; a test seam so unit/e2e can
      capture the link instead of sending
- [ ] 2.6 Unit tests (pool-workers, local D1): token issue/consume/
      expire/supersede/used; session create/lookup/slide/expire/delete;
      `findOrCreateUser` no-dupe + normalisation; throttle; delete
      cascade

## 3. Auth API routes (`server/api/auth/`)

- [ ] 3.1 `request.post.ts` — `{ email, displayName? }` → validate,
      find-or-create, throttle, issue token, send email; always
      `{ ok: true }` (no account enumeration)
- [ ] 3.2 `callback` page route `app/pages/auth/callback.vue` (or a
      server route that redirects) — consume the `token` query param;
      on success confirm the user if pending, create a session + set
      the cookie, redirect to a same-origin `next` or `/`; on failure
      render a "link no longer valid — request a new one" page
- [ ] 3.3 `me.get.ts` — `{ user }` or `{ user: null }`; `me.patch.ts` —
      update display name (auth required)
- [ ] 3.4 `signout.post.ts` — delete the session, clear the cookie
- [ ] 3.5 `account.delete.ts` — delete the current user (cascade),
      clear the cookie
- [ ] 3.6 Route tests (`SELF.fetch`, email stubbed): request →
      captured link → callback sets a cookie → `/api/auth/me` reports
      the user; used/expired link rejected; enumeration-safe response;
      signout; delete then a fresh request makes a new pending user

## 4. Client auth state

- [ ] 4.1 `app/composables/useAuth.ts` + `app/plugins/auth.server.ts` /
      client hydration — `useState<User|null>('auth-user')` filled
      server-side from `getCurrentUser(useRequestEvent())`, refreshed
      client-side via `/api/auth/me` after sign-in/out; expose `user`,
      `isSignedIn`, `signOut()`, `requestLink(email, name?)`
- [ ] 4.2 `app/composables/useDisplayName.ts` — return the account name
      when signed in (else sessionStorage as today); the room name-gate
      shows only when neither an account nor a session name exists
- [ ] 4.3 e2e helper updates: `createRoom` / `joinRoomById` still work
      for anonymous users unchanged

## 5. Pages & shells

- [ ] 5.1 `app/pages/signup.vue` — real: one email field (+ prefilled
      name field when the client has a session name and the address
      looks new); submit → `requestLink` → "check your email for a
      sign-in link"; drop the "coming soon" alert; honour `?next=`
- [ ] 5.2 `app/pages/account.vue` (auth-required) — email shown,
      editable display name, Sign out, Delete account (with confirm)
- [ ] 5.3 `layouts/dashboard.vue`, `layouts/docs.vue`, `layouts/landing.vue`
      — a signed-in indicator (name → `/account`) or a "Sign in" link
- [ ] 5.4 e2e: request a link (captured via the test seam) → open the
      callback → signed in; still signed in after a `context` reload;
      sign out returns to anonymous; delete account

## 6. Gated docs page

- [ ] 6.1 `content.config.ts` `docs` schema — add
      `authRequired: z.boolean().optional()`
- [ ] 6.2 `content/docs/9.behind-the-scenes.md` with `authRequired: true`
      — real content on how jaime is built (stack + the OpenSpec
      spec→impl→archive loop)
- [ ] 6.3 `app/pages/docs/[...slug].vue` — when the page is
      `authRequired` and there is no current user, null the `body` in
      the data fetch (server + client) and render a "Sign in to read
      this" panel with a `/signup?next=<path>` button instead of
      `<ContentRenderer>`
- [ ] 6.4 `layouts/docs.vue` nav — mark `authRequired` sections with a
      lock icon; they stay listed
- [ ] 6.5 e2e: signed out → the page is listed (locked) and shows the
      explainer, and its prose is absent from the SSR HTML; signed in →
      the page renders

## 7. Domain-model doc

- [ ] 7.1 `docs/05-domain-model/index.md` — revise decision 3 (token is
      a repeatable single-use `AuthToken` with expiry + supersede, not a
      one-time confirmation field) and decision 6 (`User` gains nothing
      new but the token moves out; add a `Session` entity and an
      `AuthToken` entity to the Catalog context)

## 8. Verification + deploy

- [ ] 8.1 `nuxt typecheck`, `vitest run`, `playwright test` all green
      (a `wrangler dev` with migrations applied first)
- [ ] 8.2 Manually verify every scenario across
      `specs/user-account/spec.md`, `specs/identity/spec.md`,
      `specs/docs-shell/spec.md` against `wrangler dev`
- [ ] 8.3 `npm run deploy`; on `https://jaime.stream` do one real
      end-to-end sign-in with a real inbox, confirm the session
      survives a browser restart, read the gated doc, then sign out
