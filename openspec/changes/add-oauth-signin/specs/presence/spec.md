## MODIFIED Requirements

### Requirement: Presence Roster
The system SHALL show every client connected to a room a roster of who
else is currently connected to that same room, identified by display
name and, where that participant is signed in with a profile picture,
by their avatar.

#### Scenario: New client appears to others
- **WHEN** a client connects to a room
- **THEN** every other client already in that room sees the roster
  update to include the new client's display name

#### Scenario: A signed-in participant's avatar is shown
- **WHEN** a participant who is signed in with a profile picture is in
  a room
- **THEN** the other clients' rosters show that participant's avatar
  alongside their display name

#### Scenario: An anonymous participant has no avatar
- **WHEN** a participant with no profile picture is in a room
- **THEN** the other clients' rosters show a placeholder (e.g. an
  initial) for that participant, not a broken image

#### Scenario: Departed client disappears
- **WHEN** a client disconnects from a room
- **THEN** every remaining client in that room sees the roster update to
  no longer include the departed client
