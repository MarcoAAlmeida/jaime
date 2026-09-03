## ADDED Requirements

### Requirement: Sign In With GitHub
The system SHALL let a person sign in with their GitHub account as an
alternative to the email link. A successful GitHub sign-in SHALL produce
a **confirmed** account (GitHub has verified the identity — no email
step) and a session equivalent to one started by the email link. The
email-link path SHALL remain available.

#### Scenario: New person signs in with GitHub
- **WHEN** a person with no jaime account completes a GitHub sign-in
- **THEN** a confirmed account is created for them, a session is
  started, and they land in the app signed in — with no email sent

#### Scenario: GitHub sign-in for an already-registered email
- **WHEN** a person completes a GitHub sign-in whose verified email
  already has a jaime account
- **THEN** they are signed into that existing account, and no second
  account is created

#### Scenario: Returning GitHub user
- **WHEN** a person who has signed in with GitHub before does so again
- **THEN** they are signed into the same account, regardless of whether
  their GitHub username has changed since

#### Scenario: The sign-in surface offers both methods
- **WHEN** a person opens the sign-in page
- **THEN** it offers both "continue with GitHub" and the email-link
  form

#### Scenario: An interrupted or failed GitHub sign-in
- **WHEN** a GitHub sign-in is cancelled, times out, or the callback
  cannot be validated
- **THEN** no account or session is created and the person is returned
  to the sign-in page with a plain explanation

### Requirement: Profile Carries A Screen Name And Avatar
A signed-in account SHALL have a screen name (its display name) and MAY
have an avatar image. For an account created via GitHub, the screen
name SHALL be seeded from the GitHub profile and the avatar SHALL be the
GitHub profile picture. The screen name SHALL remain editable by the
account holder; the avatar is supplied by the provider and not edited
in jaime.

#### Scenario: GitHub account is seeded with a name and avatar
- **WHEN** an account is created from a GitHub sign-in
- **THEN** its display name is taken from the GitHub profile and its
  avatar is the GitHub profile picture

#### Scenario: Screen name stays editable
- **WHEN** a GitHub-signed-in account holder changes their display name
- **THEN** the new name is used everywhere the account's name is shown,
  and it is not overwritten on the next sign-in

## MODIFIED Requirements

### Requirement: Current Account Is Queryable by the Client
The system SHALL expose, to the client, whether the current request is
from a signed-in account and, if so, that account's id, email,
display name, confirmed status, and avatar URL (absent when the account
has no avatar).

#### Scenario: Signed-in request reports the account
- **WHEN** the client asks for the current account on a request that
  carries a valid session
- **THEN** it receives that account's id, email, display name, status,
  and avatar URL if it has one

#### Scenario: Anonymous request reports no account
- **WHEN** the client asks for the current account with no valid session
- **THEN** it receives an explicit "no account" answer, not an error
