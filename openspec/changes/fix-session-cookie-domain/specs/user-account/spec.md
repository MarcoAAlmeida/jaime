## ADDED Requirements

### Requirement: Session Cookie Is Shared Across jaime.stream Subdomains
The system SHALL scope the session cookie so it is sent to
`jaime.stream` and its subdomains, not only the exact host that issued
it. Ending a session SHALL clear the cookie with the same scope it was
issued with, so the clear actually removes it rather than leaving it
in place or leaving a duplicate.

#### Scenario: A subdomain receives the session cookie
- **WHEN** a signed-in person's browser makes a request to a subdomain
  of `jaime.stream`
- **THEN** the session cookie is included in that request

#### Scenario: Signing out clears the cookie a subdomain would have received
- **WHEN** a signed-in person signs out
- **THEN** the session cookie is cleared with the same scope it was
  set with, so it is also no longer sent to any subdomain

### Requirement: A Cookie Issued Before This Scope Existed Still Works On jaime.stream
The system SHALL NOT invalidate or reject a session cookie that was
issued before cross-subdomain scoping existed. Such a cookie SHALL
continue to authenticate the person on `jaime.stream` exactly as
before, and SHALL NOT be assumed to reach any subdomain until the
person's next sign-in issues a new, wider-scoped cookie.

#### Scenario: A previously-issued cookie keeps working on jaime.stream
- **WHEN** a person with a session cookie issued before this change
  makes a request to `jaime.stream`
- **THEN** they remain signed in, exactly as before this change

#### Scenario: A previously-issued cookie does not reach a subdomain until re-issued
- **WHEN** a person with a session cookie issued before this change
  makes a request to a subdomain of `jaime.stream`, without having
  signed in again since
- **THEN** that request does not carry the session cookie
