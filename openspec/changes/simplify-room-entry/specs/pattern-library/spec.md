## ADDED Requirements

### Requirement: A Pattern Can Be Loaded Into A Composition Room
The system SHALL let a user send a chosen library pattern into a new
Composition Room, where it becomes that room's shared document, so
they can start from that pattern instead of typing it or the generic
starter document.

#### Scenario: Loading a pattern opens a Composition Room with it in place
- **WHEN** a user triggers "load into Composition Room" on a library
  pattern
- **THEN** a new Composition Room opens with that user in it, and the
  shared document is the chosen pattern's code

#### Scenario: The loaded pattern is editable and playable like any other
- **WHEN** a user has loaded a pattern into a Composition Room
- **THEN** they can edit it and play it with no difference from a
  document typed from scratch

#### Scenario: Loading does not require signing up
- **WHEN** an anonymous user triggers "load into Composition Room"
- **THEN** they reach the room with the pattern loaded, with no
  signup gate
