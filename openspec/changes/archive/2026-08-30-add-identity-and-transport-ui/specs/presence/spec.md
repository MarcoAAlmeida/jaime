## MODIFIED Requirements

### Requirement: Presence Roster
The system SHALL show every client connected to a room a roster of who
else is currently connected to that same room, identified by display
name.

#### Scenario: New client appears to others
- **WHEN** a client connects to a room
- **THEN** every other client already in that room sees the roster
  update to include the new client's display name

#### Scenario: Departed client disappears
- **WHEN** a client disconnects from a room
- **THEN** every remaining client in that room sees the roster update to
  no longer include the departed client
