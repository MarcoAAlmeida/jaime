## MODIFIED Requirements

### Requirement: Sidebar Lists Home And Tools In Order
The system SHALL show a persistent sidebar listing Home, the
Composition Room, and Patterns as its main entries, in that order. JAM
SHALL be listed separately, below the main entries, as a less
prominent entry.

#### Scenario: Sidebar shows tools in the defined order
- **WHEN** a user views the dashboard shell
- **THEN** the sidebar lists Home, then Composition Room, then Patterns

#### Scenario: JAM is listed below and set apart
- **WHEN** a user views the dashboard shell
- **THEN** JAM appears in a separate group below the main entries, not
  among them
