## Context

jaime is a single public Worker (`jaime.stream`) — there is no Worker
in this project that lacks a public route. Cloudflare's service-binding
isolation guarantee ("this Worker is unreachable from the public
internet") applies to a Worker that is deployed with *no* public route
at all; it does not automatically make one route inside an otherwise
public Worker exclusive to binding callers. A route added to jaime's
existing Nitro server is reachable at the same public hostname like any
other route, whether or not jaime-games also happens to reach it via a
service binding. See proposal.md for why this endpoint exists.

## Goals / Non-Goals

**Goals:**
- Let jaime-games resolve a `jaime_session` value to an identity
  without touching `PATTERNS_DB` directly.
- Keep this endpoint from being usable by an arbitrary caller who
  simply guesses the route and supplies a stolen or guessed session
  value.

**Non-Goals:**
- Building a general-purpose identity-provider API for third parties
  beyond jaime-games.
- Changing session lifetime, creation, or invalidation semantics.
- Deploying a second, physically separate Worker for this one
  endpoint (considered, see Decisions).

## Decisions

**Shared-secret header, on jaime's existing Worker, not a separate
private Worker.** Since jaime is a public Worker, "reachable only via
the service binding" has to be enforced in the handler, not assumed
from the platform. jaime and jaime-games each hold the same secret
value as a Worker secret (`wrangler secret put`, set independently on
each side — never committed). The endpoint rejects any request that
doesn't present it, using a constant-time comparison. This is the same
trust model as an internal API key.

*Alternative considered*: deploy the verify endpoint as its own Worker
with no public route, which would get Cloudflare's "not reachable from
the public internet" guarantee natively. Rejected for now — a second
Worker to deploy, monitor, and keep in sync is disproportionate to one
read-only endpoint. Revisit if more internal-only endpoints accumulate
and a dedicated internal Worker starts paying for itself.

**Input is the raw `jaime_session` cookie value, not a re-derived
token.** jaime-games forwards exactly the value it read from the
cookie; jaime looks it up the same way it already does for a
same-origin request. No new session-identifier format is introduced.

**Response shape matches the existing "current account" shape.**
Reuses the id/display-name/avatar-URL fields already returned to
jaime's own client (`user-account`'s "Current Account Is Queryable by
the Client" requirement) rather than inventing a second shape for the
same data.

## Risks / Trade-offs

- **Shared secret leaks** → rotate it (new `wrangler secret put` on
  both sides); low blast radius since the endpoint is read-only and
  cannot create or invalidate sessions.
- **jaime-games forwards a stale or already-expired cookie** →
  handled identically to same-origin expiry: an explicit "no account"
  answer, not an error, so jaime-games just falls back to guest
  identity.
- **This becomes the first of several internal endpoints** → if that
  happens, revisit the "separate private Worker" alternative above
  instead of accumulating ad hoc secret-checked routes on jaime's
  public Worker.

## Migration Plan

Purely additive — one new route, one new secret on each side. No
existing endpoint, session behavior, or schema changes. Deploy jaime's
route first; jaime-games' side of the binding is out of scope for this
change and lands separately.
