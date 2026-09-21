## Context

`server/utils/auth.ts` today:

```ts
const SESSION_COOKIE = 'jaime_session'

export function setSessionCookie(event: H3Event, sessionId: string): void {
  setCookie(event, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
```

Neither call passes `domain`, so both default to host-only. See
proposal.md for why that's a problem for games.jaime.stream.

## Goals / Non-Goals

**Goals:**
- One correct, hard-to-drift-from Domain value used by both the set
  and clear paths.
- No behavior change on `jaime.stream` itself for existing sessions.

**Non-Goals:**
- Automatically upgrading already-active sessions to the new scope
  before the person's next sign-in (see Decisions — deliberately
  deferred, not an oversight).
- Any change to session expiry, lookup, or the other cookie
  attributes (`httpOnly`, `secure`, `sameSite`).

## Decisions

**One shared constant, not two hardcoded strings.** Add
`SESSION_COOKIE_DOMAIN = import.meta.dev ? undefined : '.jaime.stream'`
next to `SESSION_COOKIE`, and pass `domain: SESSION_COOKIE_DOMAIN` in
both `setCookie` (in `setSessionCookie`) and `deleteCookie` (in
`clearSessionCookie`). This is the actual fix for the bug this change
exists to prevent: a delete call missing the Domain a set call used
either fails to remove the real cookie or leaves a stray host-only one
behind. A single constant makes that mismatch structurally impossible
instead of a thing to remember.

**Conditional on `import.meta.dev`, mirroring `secure`.** `.jaime.stream`
is not a valid Domain for a cookie set while serving `localhost` — the
browser rejects it. `secure: !import.meta.dev` already exists in this
file for the same class of reason (no TLS in local dev); the new
constant follows the identical branch so local dev keeps getting a
plain host-only cookie that works on `localhost`.

**Deliberately not re-issuing already-active sessions' cookies
automatically.** Considered: re-setting the cookie (same session id,
new Domain) on every successful authenticated request, so an
already-signed-in person is transparently upgraded on their next visit
to jaime.stream, closing the transition gap without requiring an
explicit re-sign-in. Rejected for this change specifically because it
conflates two separate concerns: cookie *scope* (what this change is
about) and cookie *lifetime* semantics (re-setting a cookie on every
request effectively makes expiry a sliding window from last activity,
rather than fixed from sign-in — a real, separate behavior change to
`user-account`'s "Sessions Persist Across Visits and Devices"
requirement that deserves its own consideration, not a side effect of
a Domain fix). The transition cost — a person needs to sign in again
once before games.jaime.stream recognizes them — is one-time, bounded,
and already documented as acceptable in the spec's "cookie issued
before this scope existed" requirement. Revisit as a fast-follow only
if that one-time cost turns out to be a real adoption blocker in
practice.

## Risks / Trade-offs

- **A person doesn't sign in again for a long time** → they simply
  don't get cross-subdomain identity on games.jaime.stream until they
  do; jaime.stream itself is completely unaffected. No security risk,
  just a delayed benefit.
- **Wrong Domain value typo'd** (e.g. missing the leading dot, or a
  typo in the string) → caught by the shared-constant approach itself:
  wrong once means wrong consistently and visibly in testing, rather
  than silently correct on set and wrong on delete or vice versa.
