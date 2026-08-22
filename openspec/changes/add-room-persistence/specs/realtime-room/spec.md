## MODIFIED Requirements

### Requirement: Late Joiner Sees Current State
The system SHALL send a newly connecting client the room's current
pattern code immediately upon connection.

#### Scenario: Client joins an active room
- **WHEN** a client connects while the room already holds pattern code
  from earlier activity
- **THEN** the newly connected client immediately receives that current
  code, not a blank editor
