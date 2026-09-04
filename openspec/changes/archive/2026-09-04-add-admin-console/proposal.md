## Why

`add-oauth-signin` shipped, so people can now create accounts — but
Marco has no in-app way to see who they are, and no way to grant anyone
`@jah` access. The `@jah` roadmap's Phase 1 (`add-jah-chat`) is
blocked on both: it gates every model call behind an `ai_access`
allowlist that doesn't exist yet, and an allowlist is unusable without
a surface to see accounts and flip access. The AI-credits bucket-list
sequences this "**with or just before Phase 1**". Doing it first keeps
`add-jah-chat` focused on the model call and its spend controls, and
lets it consume a ready-made access check.

This change builds the operator's **knowledge + consent** layer: an
`/admin` page only Marco can open, the `ai_access` data it manages, and
the `ai_usage` table Phase 1 will write to.

## What Changes

- **New `/admin` page**, gated to Marco's identity (hard-coded GitHub
  login / email check — no roles system). Non-operators get the same
  answer as a missing page.
- **Account list** on `/admin`: every account's display name, GitHub
  login, email, confirmed status, join date, and effective `@jah`
  access.
- **Per-user `ai_access` toggle** — a write, no redeploy, takes effect
  on the user's next `@jah` attempt.
- **Env allowlist** — `AI_ACCESS_LOGINS` (comma-separated GitHub
  logins) auto-grants access without a per-user toggle, so Marco's own
  account and a handful of seeded dev friends are always in. Effective
  access = `ai_access` flag **OR** login in the env list.
- **`hasAiAccess(user)` server helper** — the single access check
  `add-jah-chat` will call. Ships here, unused until Phase 1.
- **`ai_usage` table + a recent-calls view on `/admin`** — schema and
  read surface only; Phase 1 writes the rows. Shows "no usage yet"
  until then.
- **Schema `0006`**: `users.ai_access` column; `ai_usage` table.
- Admin API routes (`/api/admin/*`) each re-check operator identity
  server-side — the page gate is not the security boundary.

Not in scope: the kill switch, budget caps, the AI Gateway, and any
model call — those ship with `add-jah-chat`. Invite codes and a richer
analytics view stay on the bucket list.

## Capabilities

### New Capabilities

- `admin-console`: an operator-only surface for seeing every account
  and controlling `@jah` access — the account list, the `ai_access`
  flag and its env-allowlist override, the effective-access check, and
  the read-only `ai_usage` view.

### Modified Capabilities

<!-- none — user-account's client payload is unchanged; ai_access is
     resolved server-side and never sent to the browser outside /admin. -->

## Impact

- **Schema**: migration `0006_ai_access_and_usage.sql` on `PATTERNS_DB`
  — `users.ai_access INTEGER NOT NULL DEFAULT 0`, new `ai_usage` table
  (user id, github login, room id, model, token counts, cost estimate,
  timestamp) with indexes for the `/admin` view.
- **New code**: `app/pages/admin.vue`; `server/routes/api/admin/*`;
  `server/utils/adminAuth.ts` (operator identity check);
  `server/auth/aiAccess.ts` (`hasAiAccess`, env-list parse);
  `server/auth/aiUsage.ts` (read helpers — write helpers land in
  `add-jah-chat`).
- **Config**: `AI_ACCESS_LOGINS` var (plain `wrangler.jsonc` var, not a
  secret — it's a list of public usernames); `.dev.vars` for local.
- **Consumed by**: `add-jah-chat` (Phase 1) calls `hasAiAccess` and
  writes `ai_usage` rows.
- **Auth**: reuses the existing `jaime_session` / `getCurrentUser`
  flow; adds an operator check on top for `/admin` and its APIs.
- No change to the anonymous experience, JAM, the Composition Room, or
  the existing account pages.
