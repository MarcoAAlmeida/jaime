## MODIFIED Requirements

### Requirement: Pattern Editing
The system SHALL provide one CodeMirror 6 editor per track in the fixed
roster, editable only by the client that currently owns that track.

#### Scenario: Editor mounts on page load
- **WHEN** a user opens the jam route and the page finishes loading
- **THEN** a CodeMirror editor instance is visible and focusable for
  each track in the roster

#### Scenario: Non-owner cannot edit a track
- **WHEN** a user views a track they do not own
- **THEN** that track's editor does not accept edits from them
