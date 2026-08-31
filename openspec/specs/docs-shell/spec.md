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

### Requirement: A Doc Page Can Require Authentication
The system SHALL support marking a doc page as requiring
authentication: its nav entry stays visible with a lock indicator, its
content is served only to signed-in users, and a signed-out user who
opens it sees an explanation and a path to sign in rather than the
content or a dead end.

#### Scenario: Locked page is still listed in the nav
- **WHEN** a signed-out user views the docs nav tree
- **THEN** an auth-required page is listed, marked as locked

#### Scenario: Signed-out user sees the explainer, not the content
- **WHEN** a signed-out user opens an auth-required doc page
- **THEN** they see a message that the page requires signing in and a
  control to sign in, and the page's body content is not present in the
  response

#### Scenario: Signed-in user reads the page normally
- **WHEN** a signed-in user opens an auth-required doc page
- **THEN** the page renders its content like any other doc page
