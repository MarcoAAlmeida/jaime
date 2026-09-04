## Context

See proposal.md — Why. `add-oauth-signin` shipped: `users` now has
`github_id` / `github_login` / `avatar_url`, sessions resolve via
`getCurrentUser(event)` / `getSessionUser(db, sid)`, and both return the
`User` shape from `shared/user.ts`. There is no operator concept yet and
no `ai_*` data. The AI-credits bucket-list
(`docs/04-roadmap/99-bucket-list/ai-credits-and-access-control.md`)
defines the access model; this change implements §1 (allowlist), §5
(operator visibility), and the read half of §4 (usage view).

Constraints: single Durable Object, Nitro `cloudflare-durable` preset,
`PATTERNS_DB` D1 for all account data, migrations in
`migrations/patterns/`. Auth helpers auto-imported from
`server/utils/**`.

## Goals / Non-Goals

**Goals:**

- One `/admin` page and a small `/api/admin/*` surface, both gated to
  Marco's identity, that make the `ai_access` allowlist manageable
  without a redeploy.
- A single `hasAiAccess(user)` check that `add-jah-chat` will call — the
  only place the flag and the env list are combined.
- The `ai_usage` table schema and its read view, ready for Phase 1 to
  write into.

**Non-Goals (ship with `add-jah-chat` or later):**

- The AI Gateway, budget caps, the kill switch, and any model call.
- Writing `ai_usage` rows.
- A roles/permissions system — the operator check stays hard-coded.
- Invite codes, Analytics Engine, per-account budgets.

## Decisions

### 1. Effective access is computed at read time, never written on sign-in

`hasAiAccess(user)` returns `user.aiAccess === true || envLogins.has(user.githubLogin?.toLowerCase())`.

- `users.ai_access` is a pure record of **manual** operator grants.
- The env list (`AI_ACCESS_LOGINS`) is layered on at read time, so
  adding or removing a seeded login takes effect immediately with no
  per-account write and no backfill.

Alternative — flip `ai_access` on sign-in when the login is in the env
list — rejected: it goes stale the moment the env list changes, needs a
migration/backfill to correct, and muddies "was this a manual grant?".

### 2. `AI_ACCESS_LOGINS` is a plain var, not a secret

It is a comma-separated list of **public** GitHub usernames. Lives in
`wrangler.jsonc` `vars` and `.dev.vars` locally. Parsed per request
into a lowercased `Set` (cheap; the list is a handful of names).
Comparison is case-insensitive — GitHub logins are.

### 3. Operator identity: hard-coded, two keys, checked server-side every request

`isOperator(user)` is true when `user.githubLogin === 'MarcoAAlmeida'`
**or** `user.email === 'marcoalmeida.dev.br@gmail.com'`. Two independent
keys so losing one (e.g. a GitHub rename) doesn't lock Marco out.

`requireOperator(event)` resolves the session, checks `isOperator`, and
otherwise `throw createError({ statusCode: 404 })`. Every `/api/admin/*`
handler calls it first — the page is not the security boundary. Per the
bucket-list: hard-code it, don't build roles.

### 4. Non-operators get 404, not 403

`/admin` and its APIs must not acknowledge they exist to anyone but the
operator (spec: "treated as a missing page"). The page uses a route
middleware that `throw createError({ statusCode: 404, fatal: true })`
for a non-operator; the APIs do the same. One server-side log line
(`admin refused for <userId>`) is emitted when a *signed-in* account is
refused, so "Marco is locked out" is distinguishable from "the route
broke" in logs without weakening the response.

### 5. `ai_usage` schema now, writes later

```
ai_usage(
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  github_login  TEXT,            -- denormalized (see decision 6)
  room_id       TEXT,
  model         TEXT NOT NULL,
  prompt_tokens        INTEGER NOT NULL DEFAULT 0,
  completion_tokens    INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd    REAL    NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
)
```

Indexes: `(created_at DESC)` for the view, `(user_id)` for future
per-user rollups. `add-jah-chat` adds the write helper
(`server/auth/aiUsage.ts` gains `recordUsage(...)`); this change ships
only `listRecentUsage(db, limit)`.

### 6. Usage rows are denormalized and outlive the account

`github_login` is copied onto each row rather than joined, and account
deletion does **not** cascade to `ai_usage`. Rationale: the bucket-list
wants usage attribution "good enough to bill against if a paid tier
appears" — that record has to survive the user leaving. The retained
data is minimal (a public username + counts), operator-only, and never
shown outside `/admin`.

This is a deliberate carve-out from `user-account`'s "Delete Account"
requirement, which enumerates sessions and sign-in links but not usage
records. Noted here rather than modifying that spec, because the table
is empty until Phase 1 and a privacy-policy pass may revisit retention
then (a "purge usage older than N months" job is the likely answer).

### 7. Route shape

- `GET  /api/admin/users` → `[{ id, displayName, email, githubLogin, status, createdAt, aiAccess, effectiveAccess: 'flag' | 'allowlist' | 'none' }]`
- `PATCH /api/admin/users/:id` body `{ aiAccess: boolean }` → updated row
- `GET  /api/admin/usage?limit=50` → recent `ai_usage` rows

`app/pages/admin.vue` renders two tables (`UTable`), `layout: 'landing'`,
`middleware: ['auth', 'operator']`.

## Risks / Trade-offs

- **Hard-coded operator check** → if both the GitHub login and the email
  change, Marco is locked out of `/admin`. Mitigation: two independent
  keys; the fix is a one-line edit + redeploy; `wrangler d1 execute`
  remains the always-available fallback for the roster and the toggle.
- **404 masks a broken operator check** → a bug in `isOperator` looks
  like "page missing" to Marco. Mitigation: the refused-while-signed-in
  log line (decision 4).
- **`ai_usage` retains a deleted account's `github_login`** → minor
  privacy trade-off. Mitigation: operator-only, minimal fields, revisit
  retention when Phase 1 fills the table (decision 6).
- **Env var vs D1 for the allowlist** → editing `AI_ACCESS_LOGINS` needs
  a redeploy, unlike the per-user toggle. Accepted: the env list is the
  "seeded, rarely-changes" tier; the toggle is the "add someone now"
  tier. Matches the bucket-list's two-tier model.

## Migration Plan

1. `0006_ai_access_and_usage.sql` — `ALTER TABLE users ADD COLUMN
   ai_access INTEGER NOT NULL DEFAULT 0`; `CREATE TABLE ai_usage (...)`;
   two `CREATE INDEX`. Purely additive; nothing shipped reads either
   until this change's `/admin`, and nothing writes `ai_usage` until
   `add-jah-chat`.
2. `npm run deploy` applies `0006` to the remote D1 before the Worker
   goes live (existing `scripts/deploy.mjs` ordering).
3. Set `AI_ACCESS_LOGINS` in `wrangler.jsonc` (`["MarcoAAlmeida"]` to
   start) and `.dev.vars`.

**Rollback:** redeploy the previous Worker version. Leave the column and
table in place — unused, harmless. No data loss (the table is empty or
holds only operator-visible counters).
