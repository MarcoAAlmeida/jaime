## ADDED Requirements

### Requirement: The Editor Exposes The Current Selection

The system SHALL let the surrounding application read the editor's
current text selection — the selected text and its position — at any
time, including after focus has moved away from the editor to another
control.

#### Scenario: A selection remains readable after focus moves away
- **WHEN** a person selects text in the editor and then moves focus to
  another control (for example, the chat input)
- **THEN** the editor's current selection is still readable, unchanged

#### Scenario: No selection reads as empty, not an error
- **WHEN** nothing is currently selected in the editor
- **THEN** reading the selection returns an empty result, not an error
