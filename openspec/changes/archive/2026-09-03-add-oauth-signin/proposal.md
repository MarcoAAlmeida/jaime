## Why

jaime's only sign-in is a passwordless email magic link — leave the
site, find the email, click, come back. That friction is fine for a
deliberate account setup but wrong for "let me try this in a jam room",
and it's the assumption the whole `@jah` roadmap rests on (phase 1
gates AI chat on being signed in). GitHub sign-in is one click, the
account is provider-verified so it lands `confirmed`, and the Strudel
audience overwhelmingly has GitHub. It also brings a **profile** —
a screen name and an avatar — that makes rooms feel like people, not
initials.

## What Changes

- **"Continue with GitHub"** on `/signup`, alongside the existing email
  field. `/auth/github` → GitHub → `/auth/github/callback` exchanges the
  code, reads the profile, and joins the *existing* session flow at
  `createSession` — the `jaime_session` cookie, `getSessionUser`, sign
  out, and account deletion are unchanged.
- A GitHub sign-in **creates a `confirmed` account** (the provider
  verified the identity — no email round-trip). Signing in with GitHub
  for an email that already has an account signs into **that** account
  (match on GitHub id, fall back to verified email; no separate
  identities table).
- **Profile**: the account's `display_name` (the screen name JAM and
  the Composition Room already use for presence) is seeded from the
  GitHub name, still editable in `/account`. The account also carries an
  **avatar URL** from GitHub.
- **Avatars in rooms**: the presence roster (JAM and Composition Room)
  and the Composition Room chat show a participant's avatar when they
  have one; anonymous / magic-link participants keep an initial.
- **Magic link stays** as the fallback. Google is a fast-follow on the
  same handler abstraction — not this change.
- `nuxt-auth-utils` added as a dependency (for the OAuth handshake
  only; its own session mechanism is not used). `GITHUB_CLIENT_ID` /
  `GITHUB_CLIENT_SECRET` become jaime's first Worker **secrets**.

## Capabilities

### New Capabilities
<!-- none — this extends the existing account, presence, and
     composition-room capabilities rather than introducing a new one. -->

### Modified Capabilities
- `user-account`: adds a GitHub OAuth sign-in path that produces a
  confirmed account and reuses the existing session; a GitHub sign-in
  for an already-registered email signs into that account; the current
  account is queryable with an avatar URL.
- `presence`: a room's roster identifies each participant by display
  name **and**, where they are signed in with a profile picture, their
  avatar.
- `composition-room`: the presence roster and the chat attribute each
  participant / message by display name and avatar where available.

## Impact

- **Dependencies**: `nuxt-auth-utils` (new).
- **Secrets**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  (`wrangler secret put`); one registered GitHub OAuth App with dev +
  prod callback URLs.
- **Schema**: migration `0005` — `users` gains `avatar_url`,
  `github_login`, `github_id` (unique).
- **Code**: `server/routes/auth/` (new GitHub start + callback routes),
  `server/auth/users.ts` (`findOrCreateUser` matches GitHub id),
  `shared/user.ts` (`avatarUrl?`), `app/pages/signup.vue` (the button),
  `shared/compositionProtocol.ts` (`avatarUrl?` on presence entry + chat
  message), the JAM room protocol / presence payload, and the roster /
  chat components in both rooms.
- **No** change to the transport clock, Yjs sync, or the AI roadmap.
