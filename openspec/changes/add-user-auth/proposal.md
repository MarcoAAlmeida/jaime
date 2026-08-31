## Why

Today jaime has no accounts — identity is a display name in
`sessionStorage` that vanishes when the tab closes and never leaves the
device. Roadmap Phase 2b is the identity foundation the rest of the
product builds on: a durable `User`, a real sign-up + sign-in flow, and
sessions that persist across visits and devices. This change also lands
one gated docs page, so the "feature is locked — here's how to unlock
it" pattern (user story 53) is real and exercised now rather than
waiting for a Phase 7 gated feature.

This supersedes the `hub-mock-screens` community-signup mock and the
`identity` capability's "display name never persists" rule (still true
for anonymous users; an account's name is now durable).

## What Changes

- **A durable `User`.** `id`, `email`, `displayName`, `status`
  (`pending` → `confirmed`), `createdAt`. Stored in the existing Catalog
  D1 (`PATTERNS_DB`), schema-versioned via `wrangler d1 migrations`.
  Anonymous is still the *absence* of a `User` row — no change there.
- **Passwordless magic-link auth.**
  - Sign up / sign in: enter an email (plus a display name if it's a
    new account) → a single-use, short-lived link is emailed → clicking
    it confirms the address (first time), starts a session, and lands
    the user back in the app.
  - The same request path works for a returning user — "sign in" and
    "sign up" are one form.
  - Sessions are server-side, cookie-referenced, and persist across
    browser restarts and — because the account is shared — across
    devices (sign in on each device once).
  - Sign out ends the current session; delete-account removes the
    `User`, its sessions, and any outstanding tokens.
- **Cloudflare Email Sending** from `noreply@jaime.stream` for the
  magic-link email (transactional — the only mail jaime sends). Basic
  per-email request throttling; the email states plainly that no
  account is created or changed without clicking the link.
- **Display-name promotion.** While signed in, the display name comes
  from the account (editable there); the room name-gate is skipped.
  Signed out, `sessionStorage` behaves exactly as today.
- **One gated docs page.** A new docs page marked auth-required. Its
  nav entry stays visible with a lock indicator; opening it while
  signed out shows a "sign in to read this" panel with a sign-in call
  to action, and its body is not served in the page source to
  unauthenticated requests.
- **Doc update:** `docs/05-domain-model/index.md` decisions 3 and 6 —
  the token becomes a repeatable single-use `AuthToken` and a `Session`
  entity is added.

## Capabilities

### New Capabilities
- `user-account`: durable user accounts and passwordless authentication
  — the `User` entity and its lifecycle, requesting and consuming a
  magic-link token, email confirmation, sessions that persist across
  visits and devices, sign out, and account deletion.

### Modified Capabilities
- `identity`: the "display name does not persist across sessions" rule
  now applies only to users without an account; a signed-in user's
  display name is supplied from their `User` and persists.
- `docs-shell`: a doc page can require authentication — it stays listed
  in the nav (with a lock indicator) but its content is shown only to
  signed-in users, with an explainer and a sign-in path otherwise.
- `hub-mock-screens`: remove "Community Signup Mock Accepts An Email" —
  signup is a real feature now (`user-account`), not a mock.

## Impact

- **Infra:** Cloudflare Email Sending enabled on `jaime.stream` (auto
  SPF/DKIM DNS); a `send_email` binding; a `compatibility_date` bump so
  the binding is available; new D1 migrations for `users`, `sessions`,
  `auth_tokens`.
- **New code:** `server/api/auth/*` (request, callback, me, signout,
  account), `server/auth/` (Catalog-context data access + session
  verification + token hashing + email send), a `useAuth()` composable
  + a plugin to hydrate auth state.
- **Changed code:** `app/pages/signup.vue` → real sign-in/register page;
  `app/composables/useDisplayName.ts` (account-aware); the room
  name-gate; the two shells (`layouts/dashboard.vue`,
  `layouts/docs.vue`) gain a signed-in/out control; `app/pages/docs/`
  (gate the auth-required page); `content.config.ts` (an `authRequired`
  field); `wrangler.jsonc`; `docs/05-domain-model/index.md`.
- **Specs:** new `user-account`; `identity`, `docs-shell`,
  `hub-mock-screens` each modified.
- **Not touched:** the realtime protocol, JAM, Composition Room, the
  pattern-library API, `@nuxt/content`'s own D1.
