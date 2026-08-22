## MODIFIED Requirements

### Requirement: Room Connection
The system SHALL establish a WebSocket connection from the browser to
the room identified by the current URL on page load.

#### Scenario: Client connects successfully
- **WHEN** a user opens a room's URL
- **THEN** a WebSocket connection to that room is established

#### Scenario: Connection drops without crashing the editor
- **WHEN** the WebSocket connection closes unexpectedly
- **THEN** the editor remains usable for local editing and does not error
