## Purpose

Provides the WebSocket connection to a single hardcoded room and relays
pattern-code updates between the clients connected to it, gated by
track ownership (see the `track-ownership` capability).

## Requirements

### Requirement: Room Connection
The system SHALL establish a WebSocket connection from the browser to a
single hardcoded room on page load.

#### Scenario: Client connects successfully
- **WHEN** a user opens the jam route
- **THEN** a WebSocket connection to the room is established

#### Scenario: Connection drops without crashing the editor
- **WHEN** the WebSocket connection closes unexpectedly
- **THEN** the editor remains usable for local editing and does not error

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

### Requirement: Late Joiner Sees Current State
The system SHALL send a newly connecting client the room's current
in-memory pattern code immediately upon connection.

#### Scenario: Client joins an active room
- **WHEN** a client connects while the room already holds pattern code
  from earlier activity
- **THEN** the newly connected client immediately receives that current
  code, not a blank editor
