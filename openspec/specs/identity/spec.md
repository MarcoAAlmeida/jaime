# identity Specification

## Purpose
Lets a user be recognizable to others in a room by a display name for
the current session, without requiring an account.

## Requirements

### Requirement: Set Display Name Without An Account
The system SHALL let a user set a display name for their session
without requiring account credentials.

#### Scenario: User sets a name without signing in
- **WHEN** a user opens the app for a session
- **THEN** they can set a display name without providing any account
  credentials

### Requirement: Display Name Required To Join A Room
The system SHALL require a display name to be set before a user joins a
room. The prompt SHALL suggest a name by default rather than starting
empty, so a user is never required to type before proceeding — they
may accept the suggestion as-is or replace it with their own.

#### Scenario: Joining without a name prompts for one
- **WHEN** a user attempts to create or join a room without having set a
  display name
- **THEN** they are prompted to set one before entering the room

#### Scenario: The prompt suggests a name by default
- **WHEN** a user without an account or a previously-set name reaches
  the display-name prompt
- **THEN** the prompt already shows a suggested name that they can
  accept immediately or edit before proceeding

### Requirement: Display Name Does Not Persist Across Sessions
The system SHALL NOT assume a display name from a previous session for
a user without an account. A signed-in user's display name is supplied
from their account and persists across sessions and devices.

#### Scenario: A new session starts with no assumed name
- **WHEN** a user without an account starts a new session
- **THEN** the system does not assume any previously-used display name
  for them

#### Scenario: A signed-in user's name is already set
- **WHEN** a signed-in user starts a new session on any device
- **THEN** their display name is their account's display name, without
  being asked to set one again

#### Scenario: Signing in adopts the account name
- **WHEN** a user who set a session display name while anonymous then
  signs in
- **THEN** their account's display name is used from that point on
