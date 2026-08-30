## ADDED Requirements

### Requirement: A Pattern Can Be Loaded Into JAM
The system SHALL let a user send a chosen library pattern into JAM,
where it becomes the code of a track that user owns, so they can start
from that pattern instead of retyping it.

#### Scenario: Loading a pattern opens a JAM room with it in place
- **WHEN** a user triggers "load into JAM" on a library pattern
- **THEN** a new JAM room opens with that user in it, and once they own
  a track that track's code is the chosen pattern's code

#### Scenario: The loaded pattern is editable and playable like any other
- **WHEN** a user has loaded a pattern into their JAM track
- **THEN** they can edit it and play it with no difference from a
  pattern they typed themselves

#### Scenario: Loading does not require signing up
- **WHEN** an anonymous user triggers "load into JAM"
- **THEN** they reach the room with the pattern loaded, with no signup
  gate
