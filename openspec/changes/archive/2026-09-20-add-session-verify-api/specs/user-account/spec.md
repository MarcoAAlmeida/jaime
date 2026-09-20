## ADDED Requirements

### Requirement: Current Account Is Queryable By A Trusted Service Binding
The system SHALL let a request arriving over an internal Cloudflare
service binding — not a same-origin browser request — present a
session identifier and receive the same answer a same-origin client
would get: the account's id, display name, and avatar URL if the
session is valid, or an explicit "no account" answer if it is absent,
invalid, or expired. This SHALL NOT create, refresh, or invalidate any
session, and SHALL NOT change the response given to same-origin
browser requests.

#### Scenario: A trusted caller resolves a valid session
- **WHEN** a request arrives over the service binding presenting a
  session identifier that is currently valid
- **THEN** the response includes that account's id, display name, and
  avatar URL (if it has one)

#### Scenario: A trusted caller gets an explicit answer for no session
- **WHEN** a request arrives over the service binding presenting a
  session identifier that is missing, invalid, or expired
- **THEN** the response is an explicit "no account" answer, not an
  error, and no session is created as a side effect

#### Scenario: The endpoint is not reachable from outside the account
- **WHEN** a request for this endpoint arrives by any path other than
  the internal service binding (e.g. a direct public request)
- **THEN** the system does not return account data, regardless of what
  session identifier is presented

#### Scenario: Querying does not affect session state
- **WHEN** a service-binding caller queries a valid session any number
  of times
- **THEN** the session's validity and expiry are unaffected — the
  query has no side effects
