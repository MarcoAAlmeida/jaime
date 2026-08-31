## Context

See proposal.md — Why. State that shapes the approach:

- One domain D1 database exists — `PATTERNS_DB` (Catalog context),
  schema managed with `wrangler d1 migrations` (`migrations/patterns/`),
  applied on deploy by `scripts/deploy.mjs`. `@nuxt/content`'s `DB` is
  separate and untouched.
- Identity today: `app/composables/useDisplayName.ts` (sessionStorage),
  and the JAM room page gates rendering on a display name before
  connecting the WebSocket. `identity` spec: display name never
  persists across sessions.
- Docs are SSR (`@nuxt/content`, `content.config.ts` `docs` collection,
  `app/pages/docs/index.vue` + `[...slug].vue`, `app/layouts/docs.vue`
  builds the nav from `queryCollectionNavigation`).
- `/signup` is a mock page (`app/pages/signup.vue`).
- Nitro `cloudflare-durable` preset; bindings reached via
  `event.context.cloudflare.env` (see `server/utils/patternsDb.ts`).
- The project has no server-side secret store in use and no session
  layer.

## Goals / Non-Goals

**Goals:**
- Passwordless auth with no password storage and no third-party IdP.
- Sessions that survive browser restarts and work per-device.
- Anonymous use is completely unchanged.
- One reusable auth seam for the client (`useAuth()`) and the server
  (`getSessionUser(event)`).
- The gated-doc mechanism generalises to future gated features.

**Non-Goals:**
- Passwords, OAuth / social login, TOTP / 2FA.
- Org/team accounts, roles, permissions beyond "signed in or not".
- Email change / merge flows (delete + re-register covers it for now).
- Rate limiting beyond a simple per-email throttle (IP limiting noted
  as a follow-up).
- Marketing email — Cloudflare Email Sending is transactional only.
- Renaming the `PATTERNS_DB` binding (it already holds the Catalog
  context; a rename is churn for no behaviour change).

## Decisions

### 1. Magic-link tokens: hashed, single-use, 15 min, one live per account

`POST /api/auth/request { email, displayName? }`:
- normalise the email (trim + lowercase), validate shape;
- find-or-create the `User` (`status: 'pending'` on create, capture
  `displayName` if given);
- throttle: reject with the same generic response if this user
  requested a link < 60 s ago (`users.last_auth_request_at`);
- generate 32 random bytes → the raw token (base64url); store only its
  SHA-256 hash in `auth_tokens` with `user_id`, `expires_at` (now +
  15 min), `used_at NULL`; **delete any prior unused token for this
  user** so only the latest is valid;
- email `https://jaime.stream/auth/callback?token=<raw>`;
- always respond `{ ok: true }` ("check your email") regardless of
  whether the account existed — no account enumeration.

`GET /auth/callback?token=<raw>` (a page route, not JSON): hash the
param, look up a matching `auth_tokens` row that is unused and unexpired;
on success — set `used_at`, set the user `confirmed` if `pending`,
create a session (below), redirect to `/` (or a `?next=` path if
present and same-origin). On failure — render a small "link expired /
already used — request a new one" page with a link back to `/signup`.

*Alternatives considered:* signed stateless tokens (JWT-style) — avoided
because single-use + supersede semantics need a server record anyway;
storing the raw token — avoided, a DB leak would hand out live links.

### 2. Sessions: opaque id, DB row, httpOnly cookie, 90-day sliding

On sign-in: 32 random bytes → session id (base64url); insert a
`sessions` row `{ id, user_id, created_at, expires_at = now + 90d,
last_seen_at }`; `setCookie(event, 'jaime_session', id, { httpOnly,
secure, sameSite: 'lax', path: '/', maxAge: 90d })`.

`getSessionUser(event)`: read the cookie, join `sessions` → `users`,
require `expires_at > now`; if the row is older than ~1 day since
`last_seen_at`, bump `last_seen_at` and `expires_at` (sliding). Returns
`{ id, email, displayName, status } | null`.

No signing secret needed — the id is random and only meaningful as a DB
key. Sign-out deletes the row + `deleteCookie`. Delete-account deletes
the user's `sessions` and `auth_tokens` then the `users` row.

`GET /api/auth/me` → `{ user }` or `{ user: null }`.

### 3. Schema — `migrations/patterns/0003_users.sql`

```sql
users(
  id              TEXT PRIMARY KEY,            -- nanoid
  email           TEXT NOT NULL UNIQUE,        -- normalised
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed'
  created_at      TEXT NOT NULL,
  last_auth_request_at TEXT                    -- throttle
)
auth_tokens(
  token_hash  TEXT PRIMARY KEY,   -- sha-256 hex of the raw token
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  used_at     TEXT
)
sessions(
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL
)
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

Data access lives in `server/auth/` (`users.ts`, `sessions.ts`,
`tokens.ts`) — the Catalog context's auth slice, same pattern as
`server/catalog/patterns.ts`.

### 4. Email via the `send_email` binding

`wrangler email sending enable jaime.stream` (auto-adds SPF/DKIM DNS).
Add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc` and bump
`compatibility_date` to a 2025 date so the binding is available. Local
dev / tests use `"remote": true` only when actually exercising a real
send; the auth unit/e2e tests stub the send. `from: { email:
'noreply@jaime.stream', name: 'jaime' }`, both `html` and `text`
bodies, a plain honest message including "if you didn't request this,
ignore it — nothing changes until you click."

*Fallback:* if the binding is unavailable at runtime the request route
returns a 503 with a clear message rather than silently succeeding.

### 5. Client auth state — `useAuth()` + a plugin

A `useState<User | null>('auth-user')` hydrated once: server-side from
`getSessionUser(useRequestEvent())` in a Nuxt plugin so SSR knows the
user; client-side kept in sync by calling `/api/auth/me` after
sign-in/out. `useAuth()` exposes `user`, `isSignedIn`, and
`signOut()` / `requestLink(email, name?)` helpers.

`useDisplayName` becomes account-aware: if `useAuth().user`, the
display name is `user.displayName` (read-only here; edited via the
account page which PATCHes the user); else sessionStorage as today.
The room name-gate renders only when there is neither an account name
nor a session name.

### 6. `/signup` → the sign-in / register page; `/account`

`/signup` (kept — it's the linked path): one email field; if the client
has a session-storage display name and the address looks new, also show
a name field (prefilled). Submit → `requestLink` → "check
`you@example.com` for a sign-in link." No "coming soon" alert.

`/account` (new, behind auth): shows the email, an editable display
name (`PATCH /api/auth/me`), a Sign out button, and a Delete account
button with a confirm step. Both shells (`layouts/dashboard.vue`,
`layouts/docs.vue`) and the landing header get a signed-in indicator
(name → `/account`) or a "Sign in" link.

### 7. Gated doc page

`content.config.ts` `docs` schema gains `authRequired: z.boolean().optional()`.
Add `content/docs/9.behind-the-scenes.md` with `authRequired: true` —
real content (how jaime is built: the stack, the OpenSpec
spec→impl→archive loop). The nav in `layouts/docs.vue` marks
`authRequired` entries with a lock icon (still listed).

`app/pages/docs/[...slug].vue`: in its `useAsyncData`, if the page is
`authRequired` and `getSessionUser` (server) / `useAuth().user`
(client) is absent, **return the page's frontmatter but null its
`body`** so the prose is never in the response; the template then
renders a "Sign in to read this" panel with a `/signup?next=<path>`
button instead of `<ContentRenderer>`. A signed-in user gets the full
page. (`index.vue` is `/docs` itself and is never gated.)

## Risks / Trade-offs

- **Someone submits a stranger's email repeatedly → unwanted mail.** →
  Per-account 60 s throttle + "one live link" supersede limits volume;
  the email body makes clear no account is created or changed without
  clicking. IP-level rate limiting is a noted follow-up (needs KV or a
  DO counter).
- **Session table grows.** → Rows carry `expires_at`; a periodic
  cleanup (a cron `defineTask` or lazy delete on lookup of an expired
  row) keeps it bounded. Cheap at jaime's scale.
- **Email deliverability / the link landing in spam.** → Cloudflare
  auto-handles SPF/DKIM/IP reputation; the message is plain and
  transactional; the `/signup` confirmation screen tells the user to
  check spam and offers a resend.
- **`compatibility_date` bump** could shift other runtime behaviour. →
  Bump to a specific tested date, run the full suite, deploy once.
- **SSR gating correctness.** → The gate is applied in the page's data
  fetch (server + client), asserted by a spec scenario ("body content
  is not present in the response") and an e2e that greps the SSR HTML.
- **No secret to rotate is a feature, but session theft via cookie is
  possible.** → httpOnly + secure + sameSite=lax; deletion and sign-out
  give the user a kill switch; acceptable for the current threat model.

## Migration Plan

1. `wrangler d1 migrations create PATTERNS_DB users` → fill `0003`.
   `wrangler email sending enable jaime.stream`. `send_email` binding +
   `compatibility_date` bump in `wrangler.jsonc`; `wrangler types`.
2. `server/auth/` data access + hashing + `getSessionUser`; unit tests
   (pool-workers, local D1) for token lifecycle, session lifecycle,
   throttle, enumeration-safe response.
3. `server/api/auth/*` routes + tests (`SELF.fetch`), email send stubbed.
4. `useAuth()` + plugin; `useDisplayName` account-awareness; room
   name-gate.
5. `/signup` real; `/account`; shells' signed-in control.
6. `content.config.ts` `authRequired`; `9.behind-the-scenes.md`; the
   `[...slug].vue` gate + docs nav lock.
7. `docs/05-domain-model/index.md` — revise decisions 3 & 6, add
   `Session`, add `AuthToken`.
8. e2e: request link → (capture the link from the stubbed send / a test
   hook) → callback → signed in across a browser restart; gated doc
   hidden then shown; sign out; delete account.
9. `npm run deploy` (build → `d1 migrations apply --remote` →
   `wrangler deploy`); one real end-to-end sign-in on `jaime.stream`.

**Rollback:** additive — new tables, new routes, one rewritten page, a
new gated doc. Revert the commit + redeploy; the tables can be left.
Anonymous behaviour is unchanged throughout, so a rollback strands no
one — signed-in users simply become anonymous again.

## Open Questions

- The exact copy and any resend cadence on the `/signup` "check your
  email" screen — refine during implementation, does not affect specs.
- Whether `last_seen_at` sliding should also cap total session age
  (e.g. force re-auth after 1 year regardless of activity) — safe to
  decide later; default is pure sliding.
