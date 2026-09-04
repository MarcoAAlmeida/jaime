## MODIFIED Requirements

### Requirement: Presence Shows Who Is In The Room And Their Role
The system SHALL show every participant a live roster of who else is in
the room and whether each is an editor or a viewer, scoped to that
room. Each entry SHALL show the participant's display name and, where
they are signed in with a profile picture, their avatar.

#### Scenario: Roster updates as people come and go
- **WHEN** a participant joins or leaves a Composition Room
- **THEN** every other participant's roster reflects the change,
  including the joiner's or leaver's role

#### Scenario: A signed-in participant shows their avatar
- **WHEN** a participant signed in with a profile picture is in the room
- **THEN** the roster shows their avatar next to their name and role;
  a participant with no picture shows a placeholder, not a broken image

### Requirement: Ephemeral Room Chat
The system SHALL provide a text chat beside the editor for the people
in the room. Messages are delivered to everyone currently connected and
are not persisted — chat history is empty after a restart or once the
room empties. Each message SHALL be attributed to the sender's display
name and, where the sender is signed in with a profile picture, their
avatar.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name, with the sender's avatar
  when they have one

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat panel is empty
