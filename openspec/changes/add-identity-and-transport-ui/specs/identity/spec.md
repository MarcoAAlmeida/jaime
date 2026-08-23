## Purpose

Lets a user be recognizable to others in a room by a display name for
the current session, without requiring an account.

## ADDED Requirements

### Requirement: Set Display Name Without An Account
The system SHALL let a user set a display name for their session
without requiring account credentials.

#### Scenario: User sets a name without signing in
- **WHEN** a user opens the app for a session
- **THEN** they can set a display name without providing any account
  credentials

### Requirement: Display Name Required To Join A Room
The system SHALL require a display name to be set before a user joins a
room.

#### Scenario: Joining without a name prompts for one
- **WHEN** a user attempts to create or join a room without having set a
  display name
- **THEN** they are prompted to set one before entering the room

### Requirement: Display Name Does Not Persist Across Sessions
The system SHALL NOT assume a display name from a previous session.

#### Scenario: A new session starts with no assumed name
- **WHEN** a user starts a new session
- **THEN** the system does not assume any previously-used display name
  for them
