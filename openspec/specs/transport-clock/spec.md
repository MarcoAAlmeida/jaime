## Purpose

Keeps every client's playback in phase by correcting for each client's
clock offset from the Durable Object, so patterns start together without
any audio crossing the wire.

## Requirements

### Requirement: Clock Offset Estimation
The system SHALL estimate each client's clock offset from the Durable
Object's clock when the client connects.

#### Scenario: Client estimates its offset on connect
- **WHEN** a client establishes its WebSocket connection
- **THEN** the client computes an estimated offset between its local
  clock and the Durable Object's clock

### Requirement: Synchronized Playback Start
The system SHALL schedule each client's playback start against the
shared `cycleStartTimestamp`, corrected by that client's estimated
offset, so connected clients start the same cycle in phase.

#### Scenario: Clients start the same cycle in phase
- **WHEN** two clients both have a track playing under the shared clock
- **THEN** their local playback positions remain within tolerance of
  each other over time, not drifting apart

### Requirement: Tempo Change Re-lock
The system SHALL apply a tempo change by choosing a new
`cycleStartTimestamp` at the next bar boundary and broadcasting it,
rather than changing tempo immediately.

#### Scenario: Tempo change re-locks at the next bar boundary
- **WHEN** the tempo is changed
- **THEN** connected clients continue the current bar at the old tempo
  and re-lock to the new tempo starting at the next bar boundary
