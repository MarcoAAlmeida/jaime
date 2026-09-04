## 1. Schema + config

- [x] 1.1 `migrations/patterns/0006_ai_access_and_usage.sql` — `ALTER
      TABLE users ADD COLUMN ai_access INTEGER NOT NULL DEFAULT 0`;
      `CREATE TABLE ai_usage` per design decision 5; `CREATE INDEX`
      on `ai_usage(created_at)` and `ai_usage(user_id)`.
- [x] 1.2 `shared/user.ts` — `User` gains `aiAccess: boolean`.
      `server/auth/users.ts` `UserRow` + `toUser` map `ai_access`
      (0/1) → `aiAccess`. `server/auth/sessions.ts` `SessionUserRow` +
      query + return include it.
- [x] 1.3 `AI_ACCESS_LOGINS` var: add to `wrangler.jsonc` `vars`
      (`"MarcoAAlmeida"` to start) and `.dev.vars`. Document the
      comma-separated format in a comment.
- [x] 1.4 `test/auth-core.test.ts` (or a sibling) — `toUser` /
      `getSessionUser` surface `aiAccess` from the row; `0005` and
      `0006` both apply in the pool-workers migration run.

## 2. Access resolution

- [x] 2.1 `server/auth/aiAccess.ts` — `parseAllowlist(raw): Set<string>`
      (comma-split, trim, lowercase, drop empties) and
      `hasAiAccess(user, allowlist): boolean` = `user.aiAccess === true
      || allowlist.has(user.githubLogin?.toLowerCase() ?? '')`.
- [x] 2.2 `effectiveAccess(user, allowlist): 'flag' | 'allowlist' |
      'none'` for the roster's "why" column (flag wins the label when
      both are true).
- [x] 2.3 Unit tests: flag-only, allowlist-only, both, neither,
      anonymous/undefined; allowlist parse (spaces, casing, trailing
      comma, empty string).

## 3. Operator gate

- [x] 3.1 `server/utils/adminAuth.ts` — `isOperator(user)` (GitHub login
      `MarcoAAlmeida` OR email `marcoalmeida.dev.br@gmail.com`);
      `requireOperator(event)` → resolves the session, returns the user,
      else `throw createError({ statusCode: 404 })`. Emit one
      `console.warn('admin refused for <userId>')` when a *signed-in*
      non-operator is refused (design decision 4).
- [x] 3.2 `app/middleware/operator.ts` — client route middleware:
      `throw createError({ statusCode: 404, fatal: true })` when
      `useAuth().user` is not the operator. `isOperator` shared with
      the server via a `shared/` helper so the identity is defined once.
- [x] 3.3 Tests: `requireOperator` passes the operator, 404s a
      non-operator and an anonymous request.

## 4. Admin APIs

- [x] 4.1 `GET /api/admin/users` — `requireOperator`, then
      `SELECT ... FROM users ORDER BY created_at DESC`; map each to
      `{ id, displayName, email, githubLogin, status, createdAt,
      aiAccess, effectiveAccess }`.
- [x] 4.2 `PATCH /api/admin/users/[id]` — `requireOperator`, validate
      body `{ aiAccess: boolean }`, `UPDATE users SET ai_access = ?
      WHERE id = ?`, return the updated mapped row. 404 if the id is
      unknown.
- [x] 4.3 `server/auth/aiUsage.ts` — `listRecentUsage(db, limit = 50)`
      → `ai_usage` rows newest first. (The write helper is
      `add-jah-chat`'s.)
- [x] 4.4 `GET /api/admin/usage` — `requireOperator`, `limit` query
      (clamp 1–200, default 50), return `listRecentUsage`.
- [x] 4.5 Pool-workers tests: each endpoint 404s a non-operator; the
      toggle flips `ai_access` and the roster reflects it; `usage`
      returns `[]` cleanly with an empty table.

## 5. Admin page

- [x] 5.1 `app/pages/admin.vue` — `definePageMeta({ layout: 'landing',
      middleware: 'operator' })` (not `['auth', 'operator']`: the spec
      needs an anonymous visitor to get the 404 page, not a sign-in
      redirect that reveals the route). Two tables (plain `<table>`,
      not `UTable` — no sorting needed for an operator tool): accounts
      (name, email, GitHub login, status, joined, access + a toggle
      per row) and recent usage (account, room, model, tokens, est.
      cost, when). Empty-state copy for the usage table.
- [x] 5.2 Toggling a row calls `PATCH /api/admin/users/[id]` and
      updates the row in place; a failed write is surfaced, not
      swallowed.
- [x] 5.3 No link to `/admin` from any nav — operator types the URL.
      (Confirm nothing renders it for non-operators.)

## 6. Tests + ship

- [x] 6.1 e2e `e2e/admin.spec.ts` (reuses `OAUTH_E2E`): the operator
      canned profile (`e2e_login=MarcoAAlmeida`) opens `/admin` and
      sees the roster; a different signed-in profile gets the 404 page;
      an anonymous visit gets the 404 page; toggling `ai_access` for a
      second account persists across a reload.
- [x] 6.2 `nuxt typecheck`, `vitest run`, `playwright test` green.
- [x] 6.3 `openspec validate add-admin-console --strict`.
- [ ] 6.4 Operator deploy: `npm run deploy` (applies `0006`); set
      `AI_ACCESS_LOGINS` if it needs to differ from the committed
      default. Verify `/admin` on `jaime.stream` shows the real roster
      and the toggle persists.
- [ ] 6.5 Sync the `admin-console` delta; archive the change.
- [x] 6.6 `docs/04-roadmap/index.md` — note `/admin` shipped and that
      `add-jah-chat` now consumes `hasAiAccess` + writes `ai_usage`.
      Tick the bucket-list "with or just before Phase 1" item.
