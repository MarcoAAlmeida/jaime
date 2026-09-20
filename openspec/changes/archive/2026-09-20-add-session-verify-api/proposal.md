## Why

jaime-games (a sibling project — separate repo, deployed to
`games.jaime.stream` on the same Cloudflare zone/account) wants a
signed-in jaime user's identity and avatar to carry over automatically,
without asking them to sign in twice or duplicating jaime's auth. It
will read the `jaime_session` cookie (shared via the parent
`.jaime.stream` cookie domain) but must not touch `PATTERNS_DB`
directly — jaime remains the sole owner of its sessions/users schema.
The missing piece is a way for a *different* Worker, calling in over a
Cloudflare service binding rather than a same-origin browser request,
to ask jaime "is this session valid, and whose is it?"

## What Changes

- Add a service-binding-only endpoint that accepts a session identifier
  and returns the same shape jaime's client already gets from "current
  account" (id, display name, avatar URL) or an explicit "no account"
  result — no new identity concept, just a new trusted caller for an
  existing query.
- The endpoint is read-only: it does not create, refresh, or invalidate
  sessions, and does not change any existing browser-facing auth
  behavior.
- Restrict the endpoint to same-account service-binding callers only
  (not reachable from the public internet) — jaime does not become a
  general-purpose identity provider for arbitrary third parties.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `user-account`: adds a requirement that the current-account query is
  also answerable for a trusted service-binding caller presenting a
  session identifier on behalf of a sibling Worker, not only for a
  same-origin browser request carrying the cookie directly.

## Impact

- Affected code: a new `server/api/` route in jaime, gated to
  service-binding callers; reads (does not write) the existing
  `sessions`/`users` tables in `PATTERNS_DB`.
- Affected systems: jaime-games gains a `services` binding in its own
  `wrangler.jsonc` pointing at jaime's Worker (config change in the
  jaime-games repo, out of scope for this change).
- No change to the email or GitHub sign-in flows, session lifetime, or
  any existing endpoint's contract.
