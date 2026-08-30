# docs-shell Specification

## Purpose
Provides the docs-style layout (nav tree, one page per topic) reached
via the dashboard's Home link, that Strudel/Hydra/TidalCycles deep-dive
content will be written into later (Phase 5) — this phase builds the
shell and structure, not the content itself.

## Requirements

### Requirement: Docs Shell Is A Distinct Layout
The system SHALL render the docs shell as a full layout distinct from
the dashboard chrome, with its own navigation.

#### Scenario: Docs shell does not carry dashboard chrome
- **WHEN** a user is in the docs shell
- **THEN** the dashboard sidebar is not present — the docs shell has
  its own nav tree

### Requirement: Nav Tree Lists Technology Sections
The system SHALL list a navigation entry for each technology the docs
will cover — starting with Strudel — even before that section's
content is written.

#### Scenario: Strudel section is reachable
- **WHEN** a user views the docs shell's nav tree
- **THEN** a Strudel entry is present and navigable, even if its
  content is a placeholder

### Requirement: Docs Shell Has A Way Back To The Dashboard
The system SHALL provide a visible path from the docs shell back into
the dashboard/tools.

#### Scenario: User returns to the dashboard from docs
- **WHEN** a user in the docs shell clicks the path back to the
  dashboard
- **THEN** they land back on the dashboard shell
