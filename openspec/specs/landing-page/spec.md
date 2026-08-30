# landing-page Specification

## Purpose
Provides jaime's real marketing entry point at the site root — what
the hub is, which tools exist, and how to get into one or reach the
docs — replacing JAM's create/join screen as the site's landing
experience.

## Requirements

### Requirement: Value Proposition Is Immediately Visible
The system SHALL present, above the fold at the site root, a statement
of what jaime is (a hub of small music-oriented tools).

#### Scenario: Visitor sees the value proposition without scrolling
- **WHEN** a visitor opens the site root
- **THEN** a heading or statement describing jaime as a hub of
  music-oriented tools is visible without scrolling

### Requirement: Tools Are Listed In Order
The system SHALL list the available tools on the landing page, with
Composition Room listed before JAM.

#### Scenario: Tools appear in the defined order
- **WHEN** a visitor views the landing page's tools section
- **THEN** Composition Room is listed before JAM

### Requirement: One Primary Call To Action
The system SHALL present one obvious primary action that leads a
visitor into a tool (e.g. "Try JAM"), distinct from secondary links.

#### Scenario: Visitor finds the primary action without hunting
- **WHEN** a visitor views the landing page
- **THEN** exactly one call-to-action is styled as primary and links
  directly into a tool

### Requirement: Docs Are Reachable From Landing
The system SHALL provide a link from the landing page directly to the
docs shell.

#### Scenario: Visitor reaches docs from landing
- **WHEN** a visitor clicks the docs link on the landing page
- **THEN** they land on the docs shell's Home section

### Requirement: Signup Is Reachable But Not Required
The system SHALL provide a path from the landing page to the community
signup screen, without requiring signup to use a tool.

#### Scenario: Visitor can reach signup without being blocked from tools
- **WHEN** a visitor clicks the primary call-to-action into a tool
  without having signed up
- **THEN** they reach the tool directly, with no signup gate in the way

### Requirement: Returning Visitor Has A Fast Path Back
The system SHALL provide a way for a returning visitor to reach the
dashboard/tools directly from the landing page, without re-reading the
marketing content.

#### Scenario: Returning visitor skips straight to the dashboard
- **WHEN** a visitor who has already used a tool returns to the site
  root
- **THEN** a visible link/button takes them directly to the dashboard
