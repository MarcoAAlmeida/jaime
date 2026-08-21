## Purpose

Lets each client claim exclusive editing rights over one track in the
fixed roster, so concurrent edits never collide, and makes current
ownership visible to everyone in the room.

## Requirements

### Requirement: Claim Track
The system SHALL let a client claim an unowned track, making it that
client's track until released.

#### Scenario: Client claims an unowned track
- **WHEN** a client requests to claim a track that has no current owner
- **THEN** that client becomes the track's owner

#### Scenario: Client cannot claim an already-owned track
- **WHEN** a client requests to claim a track that another client
  already owns
- **THEN** the claim is rejected and ownership does not change

### Requirement: Release Track
The system SHALL let the current owner of a track release it, making it
unowned again.

#### Scenario: Owner releases their track
- **WHEN** the current owner requests to release a track they own
- **THEN** the track becomes unowned and available for anyone to claim

### Requirement: Ownership Enforced
The system SHALL reject a pattern-code update for a track from any
client other than that track's current owner.

#### Scenario: Non-owner's pattern update is rejected
- **WHEN** a client sends a pattern-code update for a track it does not
  own
- **THEN** the update is rejected and not applied to the track

### Requirement: Ownership Visible
The system SHALL show every client which client, if any, currently owns
each track.

#### Scenario: Owner shown in the UI
- **WHEN** a track has a current owner
- **THEN** every connected client's UI indicates that track is owned

#### Scenario: Unowned track shown as available
- **WHEN** a track has no current owner
- **THEN** every connected client's UI indicates that track is available
  to claim
