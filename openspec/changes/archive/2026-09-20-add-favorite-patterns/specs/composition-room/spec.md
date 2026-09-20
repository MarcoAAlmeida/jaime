## MODIFIED Requirements

### Requirement: An Editor Can Clear The Shared Document
The system SHALL let a participant with the editor role clear the
shared document, replacing its content with an empty document for
every participant, only after they explicitly confirm the action. A
participant with the viewer role SHALL NOT be able to trigger this
control. If the room is currently playing, clearing SHALL stop
playback for every participant before the document is replaced,
rather than leaving the previous content's audio running.

#### Scenario: An editor clears the document after confirming
- **WHEN** an editor triggers the clear control and confirms it
- **THEN** the shared document becomes empty for every participant

#### Scenario: Canceling the confirmation leaves the document untouched
- **WHEN** an editor triggers the clear control but does not confirm it
- **THEN** the shared document is unchanged

#### Scenario: A viewer cannot clear the document
- **WHEN** a participant with the viewer role looks for the clear
  control
- **THEN** they cannot trigger it

#### Scenario: Clearing while playing stops playback for the room
- **WHEN** an editor clears the document while it is playing
- **THEN** playback stops for every participant and the document
  becomes empty, rather than the previous audio continuing under an
  empty document

## ADDED Requirements

### Requirement: An Editor Can Load A Favorited Pattern As The Shared Document
The system SHALL let a participant with the editor role replace the
whole shared document with the code of any pattern from the
pattern-library whose `favorite` flag is true, chosen from a
searchable list, for every participant. A participant with the viewer
role SHALL NOT be able to trigger this control. If the room is
currently playing, loading a pattern SHALL stop playback for every
participant before the document is replaced, rather than leaving the
previous content's audio running under the newly loaded code.

#### Scenario: An editor loads a favorited pattern
- **WHEN** an editor picks a pattern from the favorited-pattern list
- **THEN** the shared document becomes that pattern's code for every
  participant

#### Scenario: The list is searchable
- **WHEN** an editor types into the pattern picker
- **THEN** the list narrows to favorited patterns matching what they
  typed

#### Scenario: Only favorited patterns are offered
- **WHEN** an editor opens the pattern picker
- **THEN** only patterns with `favorite = true` appear in the list

#### Scenario: A viewer cannot load a pattern
- **WHEN** a participant with the viewer role looks for the pattern
  picker
- **THEN** they cannot trigger it

#### Scenario: Loading while playing stops playback for the room
- **WHEN** an editor loads a favorited pattern while the document is
  playing
- **THEN** playback stops for every participant and the document
  becomes the loaded pattern's code, rather than the previous audio
  continuing under the newly loaded code

### Requirement: The Shared Document Can Be Opened In strudel.cc
The system SHALL let any participant open the room's current shared
document directly in the official strudel.cc REPL, without a server
round-trip, regardless of whether that document originated from a
favorited pattern or was typed from scratch.

#### Scenario: Opening the current document in strudel.cc
- **WHEN** a participant triggers "open in strudel.cc"
- **THEN** a new browser tab opens strudel.cc with the shared
  document's current content ready to play
