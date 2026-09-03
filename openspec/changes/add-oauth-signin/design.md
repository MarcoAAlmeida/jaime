## Context

See `proposal.md` — Why. Current auth (`add-user-auth`):

- `users` (`id`, `email` UNIQUE, `display_name`, `status`
  `pending|confirmed`, `created_at`, `last_auth_request_at`),
  `auth_tokens`, `sessions`. Migration `0003`.
- Flow: `POST /api/auth/request` → email → `GET /auth/callback?token=`
  → `consumeToken` → `confirmUser` → `createSession` → `setSessionCookie`
  → redirect. `server/routes/auth/callback.get.ts`,
  `server/auth/{users,tokens,sessions,email}.ts`,
  `server/utils/auth.ts` (`getCurrentUser`, `requireUser`, cookie
  helpers).
- `app/plugins/auth.ts` hydrates `useState('auth-user')` from
  `/api/auth/me` during SSR; `useAuth` / `useDisplayName` read it.
- `useDisplayName().displayName` is already
  `user.value?.displayName || sessionName.value` — a signed-in user's
  room name prompt is already skipped (identity spec). Nothing to build
  there, only to verify.
- No secrets in the project; no OAuth dependency.
- Room identity on the wire today: composition passes `name` as a WS
  query param; JAM `/room` presence carries `{ clientId, name }`.

## Goals / Non-Goals

**Goals** (design-level): reuse every existing auth primitive; keep the
OAuth library at the edge of the system; never trust a client-supplied
image URL.

**Non-Goals**: Google (fast-follow, same handler shape); an
`identities` table; editing the avatar in jaime; a public profile page;
changing the magic-link flow.

## Decisions

### 1. `nuxt-auth-utils` for the handshake only; jaime's D1 session is authoritative

`defineOAuthGitHubEventHandler({ config, onSuccess, onError })` gives
the authorize redirect, `state`/CSRF cookie, token exchange, and the
`/user` + `/user/emails` calls (GitHub's private-primary-email dance)
for free. In `onSuccess({ user: gh })` we **ignore** `nuxt-auth-utils`'
`setUserSession` and instead:

```
findOrCreateUserFromGitHub(db, { githubId: gh.id, login: gh.login,
  name: gh.name, email: primaryEmail, avatarUrl: gh.avatar_url })
→ createSession(db, user.id) → setSessionCookie(event, sid)
→ sendRedirect(next)
```

- Alternative — **Arctic** (hand-rolled routes): ~40 lines, no
  competing session concept, but we'd hand-roll the `state` cookie and
  the emails call. `nuxt-auth-utils` is Nuxt-native and the ignored
  session is a one-line non-issue.
- Alternative — **Auth.js `@auth/core` + `@auth/d1-adapter`**: adapter
  wants to own the schema and session; fighting it to keep jaime's
  `sessions` table is more work than it saves.

Routes: `server/routes/auth/github.get.ts` (the handler) and
`server/routes/auth/github/callback.get.ts` — matching the existing
`server/routes/auth/callback.get.ts` placement. Config
(`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`) passed explicitly from
`event.context.cloudflare.env` rather than the `NUXT_OAUTH_*` env
convention, so it works the same under `wrangler dev` and deployed.

### 2. Account match: `github_id` first, verified email second

Migration `0005` adds `users.github_id INTEGER UNIQUE`,
`users.github_login TEXT`, `users.avatar_url TEXT`.
`findOrCreateUserFromGitHub`:

1. `SELECT ... WHERE github_id = ?` → hit: refresh `github_login` /
   `avatar_url` (they drift), return.
2. else `SELECT ... WHERE email = ?` (normalized) → hit: attach
   `github_id` / `github_login` / `avatar_url` to that row, **and set
   `status = 'confirmed'`** (GitHub verified the same address a pending
   magic-link account was waiting on), return.
3. else `INSERT` a new row: `status = 'confirmed'`, `display_name` =
   `gh.name || gh.login`, avatar from GitHub.

Never overwrite `display_name` on steps 1–2 — the user may have edited
it. **Risk**: two accounts, one per method, if GitHub's primary email
differs from the magic-link email — accepted; `identities`-table
territory, out of scope, and rare.

### 3. The avatar URL is validated server-side, not trusted from the client

Room identity is self-reported today (anyone can send any `name`). An
image URL is worse — a bad one is an XSS/tracking vector rendered in
every other participant's DOM. So:

- The **server** is the source of the avatar. On a room join the client
  sends its session cookie (composition WS: see decision 5); the server
  resolves the account and takes `avatar_url` **from the `users` row**,
  not from anything the client said.
- Defense in depth: when storing `avatar_url` in `0005` /
  `findOrCreateUserFromGitHub`, reject anything whose host is not
  `avatars.githubusercontent.com`.
- Anonymous / magic-link-without-avatar → the field is absent; the UI
  renders an initial.

### 4. Avatar on the wire

- **Shared shape**: `shared/user.ts` `User` gains `avatarUrl?: string`.
  `/api/auth/me` already returns the `User` — it just carries the new
  field.
- **Composition Room**: `CompositionPresenceEntry` and `ChatMessage`
  (`shared/compositionProtocol.ts`) gain `avatarUrl?: string`. The
  server sets it from the authenticated account on join / on send.
- **JAM `/room`**: the presence payload entry
  (`{ clientId, name }` → `{ clientId, name, avatarUrl? }`) and the
  `presence_update` message.
- Client roster / chat components (`composition/[id].vue`'s aside,
  `jam/room/[id].vue`'s presence display) render `<img>` when
  `avatarUrl` is set, an initial otherwise. A shared `<UserAvatar>` /
  `UAvatar` wrapper keeps the two rooms consistent.

### 5. Authenticating the composition WS connection

The composition room is anonymous today (`name` from a query param).
For the server to attach the right avatar it must know the account:
read `jaime_session` from the **upgrade request headers**
(`peer.request.headers` / crossws) → `getSessionUser`. Cache the
resolved `{ userId, name, avatarUrl }` on the peer at `open`.

- This is the same plumbing the `@jah` roadmap's phase 1 and phase 3
  need. Building it here means those phases inherit it.
- **Open risk to confirm in a spike**: does crossws preserve the
  `Cookie` header through the upgrade under the Nitro `cloudflare-durable`
  preset? If not, fall back to sending the session id in the `join`
  frame (works, slightly less clean). The JAM `/room` handler already
  reads query params only; the same technique applies there.
- The signed-in participant's **name** still comes from
  `useDisplayName` on the client (their editable screen name); only the
  avatar is server-resolved, because the avatar is the thing worth not
  trusting.

### 6. `OAUTH_E2E` short-circuit

Playwright can't complete a real GitHub redirect. Guard the callback:
when `env.OAUTH_E2E` is set, `/auth/github` redirects straight to
`/auth/github/callback?e2e=<url-encoded canned profile>` and the
callback, seeing `e2e`, skips the token exchange and runs
`findOrCreateUserFromGitHub` with the canned profile. Mirrors
`AUTH_E2E`. Never set in production.

## Risks / Trade-offs

- **crossws Cookie header on upgrade** → decision 5 spike; join-frame
  fallback.
- **GitHub OAuth App vs GitHub App** — an OAuth App (what we register)
  has no PKCE; `nuxt-auth-utils` handles that. Fine for `read:user` /
  `user:email`.
- **`nuxt-auth-utils` bundle** (~small, edge-safe) added to the server
  build → acceptable.
- **A user with a private GitHub email and no public email** →
  `user:email` scope + `/user/emails` still returns the primary
  (verified) address; if somehow none, create the account keyed on
  `github_id` with a synthesized no-reply email and no email-match
  linking. Rare.

## Migration Plan

1. `0005` migration (additive columns, nullable) — `npm run deploy`
   applies it remote before the code goes live, same as every prior
   migration.
2. Register the GitHub OAuth App; `wrangler secret put GITHUB_CLIENT_ID`
   / `GITHUB_CLIENT_SECRET`; add both to `.dev.vars` for local.
3. Ship. Rollback: the routes are additive and the columns are
   nullable — reverting the code leaves the schema harmless.

## Open Questions

- Whether crossws forwards the upgrade request's `Cookie` header under
  this Nitro preset (decision 5). Resolved by a spike in the first
  task; both outcomes have a known implementation, so it does not
  change the specs or the task breakdown.
