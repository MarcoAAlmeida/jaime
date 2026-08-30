## Purpose

Lets people create a new jam room or join an existing one by ID or link,
so separate groups can jam independently instead of everyone sharing one
global room.

## Requirements

### Requirement: Create Room
The system SHALL let a user create a new room without requiring a
separate server round trip to reserve it before joining.

#### Scenario: Creating a room starts a fresh session
- **WHEN** a user creates a new room
- **THEN** they land in that room with no tracks claimed and no prior
  activity

### Requirement: Join Room by ID or Link
The system SHALL let a user join an existing room using that room's ID
or a shared link, connecting them to the same room as everyone else
using that ID.

#### Scenario: Two clients with the same room ID share a room
- **WHEN** two different clients open the same room ID
- **THEN** they are connected to the same room and see each other's
  activity

### Requirement: Room ID Uniquely Addresses a Room
The system SHALL treat the same room ID as referring to the same room's
state for the lifetime of that room.

#### Scenario: Rejoining a room ID reconnects to the same state
- **WHEN** a client connects using a room ID it has used before, while
  that room is still active
- **THEN** it receives that room's current state, not a fresh one

### Requirement: Room Is Shareable
The system SHALL let a participant in a room obtain a link or code that
grants access to that same room.

#### Scenario: Participant obtains an invite
- **WHEN** a user is connected to a room
- **THEN** they can obtain a link or code that, when used by another
  user, connects that user to the same room

### Requirement: Landing Page Offers Both Paths
The system SHALL let a user, from JAM's entry point inside the
dashboard shell, either create a new room or join an existing one by
ID or link.

#### Scenario: Landing page presents both options
- **WHEN** a user opens JAM's entry point in the dashboard shell with
  no room already selected
- **THEN** they can choose to create a new room or enter an existing
  room's ID or link
