## 1. Spike + schema + dependency

- [ ] 1.1 Spike (design decision 5): does crossws preserve the `Cookie`
      header on the WS upgrade under the Nitro `cloudflare-durable`
      preset? Record the answer; pick server-reads-cookie or
      session-id-in-join-frame for group 4.
- [ ] 1.2 `npm i nuxt-auth-utils`; register it in `nuxt.config.ts` if
      the module needs it (handlers only — no `nuxt-auth-utils` session).
- [ ] 1.3 Migration `migrations/patterns/0005_oauth_profile.sql` —
      `users` + `avatar_url TEXT`, `github_login TEXT`,
      `github_id INTEGER`; `CREATE UNIQUE INDEX ... ON users(github_id)`.
- [ ] 1.4 `shared/user.ts` — `User` gains `avatarUrl?: string`.
      `server/auth/users.ts` `toUser` maps `avatar_url` → `avatarUrl`.
- [ ] 1.5 GitHub OAuth App registered (dev + `jaime.stream` callback
      URLs); `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `.dev.vars`
      and (for the operator) noted for `wrangler secret put`.

## 2. GitHub sign-in

- [ ] 2.1 `server/auth/users.ts` — `findOrCreateUserFromGitHub(db,
      profile)` per design decision 2: match `github_id`, then verified
      email (attaching + confirming), else insert a confirmed account;
      never overwrite `display_name`.
- [ ] 2.2 `avatar_url` host allowlist — store/accept only
      `avatars.githubusercontent.com` URLs; anything else → no avatar.
- [ ] 2.3 `server/routes/auth/github.get.ts` +
      `server/routes/auth/github/callback.get.ts` via
      `defineOAuthGitHubEventHandler` (`read:user`, `user:email`);
      `onSuccess` → `findOrCreateUserFromGitHub` → `createSession` →
      `setSessionCookie` → redirect to a safe `next`. `onError` →
      `/signup?error=oauth`.
- [ ] 2.4 `OAUTH_E2E` short-circuit (design decision 6): env-guarded,
      skips the token exchange with a canned profile. Add `OAUTH_E2E=1`
      to `.dev.vars`; keep it out of `wrangler.jsonc`.
- [ ] 2.5 `app/pages/signup.vue` — "Continue with GitHub" button
      (a link to `/auth/github?next=<next>`), above the email form;
      keep the email form intact.
- [ ] 2.6 `test/auth-*.test.ts` — `findOrCreateUserFromGitHub`: new
      person → confirmed account; existing verified email → attaches +
      confirms, no 2nd account; returning `github_id` with a changed
      login → same account, login refreshed; non-github avatar host →
      dropped.

## 3. Avatar in the account payload

- [ ] 3.1 `/api/auth/me` returns `avatarUrl` (rides the `User` shape —
      verify the `me.get.ts` handler passes it through).
- [ ] 3.2 A shared avatar component (`app/components/UserAvatar.vue` or
      a thin `UAvatar` wrapper): `<img>` from `avatarUrl`, initial
      fallback, fixed size, `referrerpolicy="no-referrer"`.

## 4. Avatars in rooms

- [ ] 4.1 Composition WS: authenticate the connection at `open`
      (design decision 5) — resolve `{ userId, name, avatarUrl }` from
      the session, cache on the peer.
- [ ] 4.2 `shared/compositionProtocol.ts` — `CompositionPresenceEntry`
      and `ChatMessage` gain `avatarUrl?: string`; the server fills it
      from the authenticated account on `join` / `chat` (server-resolved,
      not client-supplied — decision 3).
- [ ] 4.3 `app/pages/app/composition/[id].vue` — roster + chat render
      `<UserAvatar>`; anonymous entries show an initial.
- [ ] 4.4 JAM `/room`: presence entry + `presence_update` gain
      `avatarUrl?` (server-resolved from the session, same as 4.1/4.2);
      `jam/room/[id].vue` presence display renders it.
- [ ] 4.5 Verify the signed-in flow end to end: a GitHub user opens a
      room link and lands straight in (no name prompt — already the
      behaviour via `useDisplayName`); their avatar shows to others.

## 5. Tests

- [ ] 5.1 `e2e/oauth.spec.ts` (`OAUTH_E2E`): the button starts the
      flow; the canned callback creates a confirmed session; `/account`
      shows the seeded name; a second run signs into the same account.
- [ ] 5.2 e2e: a signed-in (GitHub) user joins a Composition Room and a
      JAM room with no name prompt; the roster/chat show their avatar;
      an anonymous participant in the same room shows an initial.
- [ ] 5.3 `nuxt typecheck`, `npm test`, `playwright test` green.

## 6. Ship + archive

- [ ] 6.1 Operator: `wrangler secret put GITHUB_CLIENT_ID` /
      `GITHUB_CLIENT_SECRET`. `npm run deploy` (applies `0005` remote).
- [ ] 6.2 On `https://jaime.stream`: real "Continue with GitHub" sign-in
      (not the E2E stub); confirm the account, avatar in a room, magic
      link still works.
- [ ] 6.3 `openspec validate add-oauth-signin --strict`.
- [ ] 6.4 Sync the `user-account` / `presence` / `composition-room`
      deltas; archive the change.
- [ ] 6.5 `docs/04-roadmap/index.md` — Phase 0 shipped; Phase 1
      (`add-jah-chat`) is next, and it inherits the authenticated-WS
      plumbing from task 4.1.
