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

### Requirement: Room Can Open With an Initial Pattern
The system SHALL let a room be opened with an initial pattern that
becomes the opening user's track code once that user has claimed a
track, without changing the room's behaviour for anyone else.

#### Scenario: The opener's track is seeded with the pattern
- **WHEN** a user opens a room with an initial pattern and then owns a
  track in that room
- **THEN** that track's code is set to the initial pattern and
  broadcast to the room like any other pattern edit

#### Scenario: A later joiner is not re-seeded
- **WHEN** another user joins that same room afterwards
- **THEN** their tracks are not seeded with the initial pattern; they
  see the room's current state like any normal join

#### Scenario: The room's shareable link is a normal room link
- **WHEN** a user opens a room with an initial pattern and then obtains
  its invite link
- **THEN** that link connects another user to the same room without
  carrying or replaying the initial pattern
