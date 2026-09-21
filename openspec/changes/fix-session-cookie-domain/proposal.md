## Why

The `jaime_session` cookie is host-only — `setSessionCookie` and
`clearSessionCookie` (`server/utils/auth.ts`) set it with no `Domain`
attribute, so browsers scope it to exactly `jaime.stream`. The sibling
site `games.jaime.stream` never receives it, which makes its
`POST /api/session/verify` call (`add-session-verify-api`, already
shipped) unreachable in practice — it has a valid contract to resolve a
session identifier, but games.jaime.stream never has one to send. This
was already identified as a known follow-up
(`docs/04-roadmap/index.md`).

## What Changes

- Scope the cookie to `.jaime.stream` in both `setSessionCookie` and
  `clearSessionCookie`, from one shared constant — not two separately
  hardcoded values, since a mismatch between the two is exactly what
  would leave the delete unable to remove the cookie it's supposed to.
- Domain scoping only applies outside local dev (mirrors the existing
  `secure: !import.meta.dev` branch already in this file) —
  `.jaime.stream` isn't a valid Domain value for a `localhost` cookie.
- `httpOnly`, `secure`, and `sameSite: 'lax'` are unchanged.
- **Not in scope**: re-issuing already-active sessions' cookies
  automatically (e.g. on every authenticated request) to close the
  transition gap faster. See design.md for why this is deliberately
  deferred rather than bundled in.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `user-account`: adds a requirement that the session cookie is scoped
  to be shared across `jaime.stream` and its subdomains, that a
  sign-out clears it with matching scope, and that a cookie issued
  before this change keeps working on jaime.stream but does not
  retroactively gain the wider scope.

## Impact

- Affected code: `server/utils/auth.ts` (`setSessionCookie`,
  `clearSessionCookie`, and the constant they share).
- No change to session lookup, expiry duration, or any other cookie
  attribute.
- Enables (but does not itself implement) games.jaime.stream actually
  calling `POST /api/session/verify` with a real session identifier —
  that wiring lives in the jaime-games repo, out of scope here.
