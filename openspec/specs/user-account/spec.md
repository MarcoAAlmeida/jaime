# user-account Specification

## Purpose

Durable user accounts and passwordless email authentication for jaime —
who a person is beyond a single browser session, proven by control of an
email address, with sessions that carry across visits and devices.

## Requirements

### Requirement: Anonymous Use Requires No Account
The system SHALL let a person use every tool and browse the library and
public docs without an account, exactly as before.

#### Scenario: A visitor with no account reaches a tool
- **WHEN** a person who has never signed in opens a tool
- **THEN** they can use it with no account and no sign-in prompt

### Requirement: Request a Sign-In Link by Email
The system SHALL let a person request a sign-in link by submitting an
email address; if no account exists for that address one is created in
an unconfirmed state, and a single-use link is emailed to the address.

#### Scenario: New address creates a pending account and emails a link
- **WHEN** a person submits an email address that has no account
- **THEN** an unconfirmed account is created for it and a single-use
  sign-in link is sent to that address

#### Scenario: Existing address is emailed a fresh link
- **WHEN** a person submits an email address that already has an account
- **THEN** a single-use sign-in link is sent to that address, and no
  second account is created

#### Scenario: The response does not reveal whether an account existed
- **WHEN** a person submits any syntactically valid email address
- **THEN** the response is the same ("check your email") whether or not
  an account already existed for that address

#### Scenario: Repeated requests for the same address are throttled
- **WHEN** a person requests links for the same address several times in
  quick succession
- **THEN** only a limited number of emails are sent, and the response
  still says "check your email"

### Requirement: The Sign-In Link Is Single-Use and Short-Lived
The system SHALL accept a sign-in link only once, only before it
expires, and only the most recently issued link for an account.

#### Scenario: A valid link signs the person in
- **WHEN** a person opens a sign-in link that has not expired, not been
  used, and is the latest issued for that account
- **THEN** a session is started for that account and the person lands
  back in the app signed in

#### Scenario: A used link is rejected
- **WHEN** a person opens a sign-in link that has already been used
- **THEN** no session is started and the person is told the link is no
  longer valid and can request a new one

#### Scenario: An expired link is rejected
- **WHEN** a person opens a sign-in link after it has expired
- **THEN** no session is started and the person is told the link has
  expired and can request a new one

#### Scenario: A superseded link is rejected
- **WHEN** a person requests a second link and then opens the first one
- **THEN** the first link is rejected

### Requirement: First Successful Sign-In Confirms the Account
The system SHALL move an account from unconfirmed to confirmed the
first time one of its sign-in links is successfully used.

#### Scenario: Pending account becomes confirmed
- **WHEN** an unconfirmed account's sign-in link is used successfully
- **THEN** the account is marked confirmed and stays confirmed for all
  later sign-ins

### Requirement: Sessions Persist Across Visits and Devices
The system SHALL keep a signed-in person signed in across browser
restarts until they sign out or the session expires, and SHALL let the
same account be signed in on more than one device independently.

#### Scenario: Still signed in after closing the browser
- **WHEN** a signed-in person closes and reopens their browser before
  the session expires
- **THEN** they are still signed in, with the same account

#### Scenario: Signing in on a second device does not disturb the first
- **WHEN** a person signs in to the same account on a second device
- **THEN** both devices are signed in, and signing out on one does not
  sign the other out

### Requirement: Sign Out
The system SHALL let a signed-in person end their current session.

#### Scenario: Signing out ends the session
- **WHEN** a signed-in person signs out
- **THEN** their session is no longer valid and subsequent requests are
  treated as anonymous

### Requirement: Delete Account
The system SHALL let a signed-in person delete their account, removing
the account, its sessions, and any outstanding sign-in links.

#### Scenario: Deletion removes the account and its sessions
- **WHEN** a signed-in person deletes their account
- **THEN** the account no longer exists, every session for it is
  invalid, and a later sign-in request for that email creates a fresh
  unconfirmed account

### Requirement: Current Account Is Queryable by the Client
The system SHALL expose, to the client, whether the current request is
from a signed-in account and, if so, that account's id, email,
display name, and confirmed status.

#### Scenario: Signed-in request reports the account
- **WHEN** the client asks for the current account on a request that
  carries a valid session
- **THEN** it receives that account's id, email, display name, and
  status

#### Scenario: Anonymous request reports no account
- **WHEN** the client asks for the current account with no valid session
- **THEN** it receives an explicit "no account" answer, not an error
