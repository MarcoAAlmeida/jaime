## Purpose

Lets a room's participants see and adjust the shared tempo, rather than
the transport clock running invisibly with no way to control it.

## ADDED Requirements

### Requirement: View Current Tempo
The system SHALL show every client connected to a room that room's
current tempo.

#### Scenario: Tempo is visible
- **WHEN** a client is connected to a room
- **THEN** it can see that room's current tempo

### Requirement: Change Tempo
The system SHALL let any client connected to a room change that room's
tempo.

#### Scenario: Changing tempo updates it for everyone
- **WHEN** a client changes a room's tempo
- **THEN** every client connected to that room sees the tempo update to
  the new value
