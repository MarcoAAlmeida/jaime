## MODIFIED Requirements

### Requirement: Ownership Visible
The system SHALL show every client which client, if any, currently owns
each track, identified by that owner's display name.

#### Scenario: Owner shown in the UI
- **WHEN** a track has a current owner
- **THEN** every connected client's UI indicates that track is owned and
  shows the owner's display name

#### Scenario: Unowned track shown as available
- **WHEN** a track has no current owner
- **THEN** every connected client's UI indicates that track is available
  to claim
