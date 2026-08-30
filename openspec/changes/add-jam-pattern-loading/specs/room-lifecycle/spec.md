## ADDED Requirements

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
