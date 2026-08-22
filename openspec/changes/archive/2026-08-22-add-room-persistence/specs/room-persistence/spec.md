## Purpose

Keeps a room's tracks, ownership, and tempo intact across the server
process restarting, so a quiet period or a redeploy doesn't silently
erase everyone's work.

## ADDED Requirements

### Requirement: Room State Survives a Server Restart
The system SHALL retain a room's track code, ownership, playback state,
and tempo across the server process restarting, so a client connecting
after a restart sees the same room state as before it.

#### Scenario: State is intact after a restart
- **WHEN** a room's server process restarts (e.g. after a period with no
  connected clients) and a client then connects to that room
- **THEN** that client receives the same track code, ownership, and
  tempo the room had before the restart, not a fresh empty room

### Requirement: Presence Reflects Only Actually-Connected Clients
The system SHALL derive a room's presence roster from clients currently
connected after a restart, rather than restoring a roster from before
the restart.

#### Scenario: Presence rebuilds from live connections after a restart
- **WHEN** a room's server process restarts and clients that were
  previously connected have since disconnected
- **THEN** the roster shown after the restart reflects only clients
  actually connected now, not anyone from before the restart who is no
  longer there
