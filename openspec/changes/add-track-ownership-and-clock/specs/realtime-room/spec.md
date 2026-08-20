## MODIFIED Requirements

### Requirement: Pattern Relay
The system SHALL broadcast a client's pattern-code update for a track to
every other client connected to the same room, only if the sending
client currently owns that track, and SHALL NOT echo the update back to
the client that sent it.

#### Scenario: Update reaches other clients
- **WHEN** the owning client changes a track's pattern code
- **THEN** every other client connected to the room receives the updated
  code for that track

#### Scenario: Sender does not receive its own update
- **WHEN** a client sends a pattern-code update
- **THEN** that same client does not receive its own update echoed back

#### Scenario: Non-owner update is rejected
- **WHEN** a client sends a pattern-code update for a track it does not
  own
- **THEN** the update is not relayed to any client
