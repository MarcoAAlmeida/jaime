# landing-page Specification

## Purpose
Provides jaime's real entry point at the site root — the developer
hangout pitch with `@jah` as the headline, how to start a room or open
a starter pattern in one, and how to reach the docs — replacing JAM's
create/join screen as the site's landing experience.

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

### Requirement: Every Tool Is One Click From The Hero
The system SHALL provide a secondary hero link straight into each tool
that isn't the primary call-to-action (Composition Room, Pattern
library), so a visitor who wants a specific tool never has to scroll
to the tools section to find it.

#### Scenario: Visitor jumps directly to Composition Room
- **WHEN** a visitor views the landing page hero
- **THEN** a secondary link labeled "Composition Room" goes directly
  to `/app/composition`

#### Scenario: Visitor jumps directly to the pattern library
- **WHEN** a visitor views the landing page hero
- **THEN** a secondary link labeled "Pattern library" goes directly to
  `/app/patterns`

### Requirement: Docs Are Reachable From Landing
The system SHALL provide a link from the landing page directly to the
docs shell.

#### Scenario: Visitor reaches docs from landing
- **WHEN** a visitor clicks the docs link on the landing page
- **THEN** they land on the docs shell's Home section

### Requirement: Articles Are Surfaced From The Landing Page
The system SHALL present a section on the landing page listing article
teasers (title, description, and a cover image), each linking directly
to that article, distinct from the Tools section and the docs link.

#### Scenario: Visitor sees article teasers on the landing page
- **WHEN** a visitor views the landing page
- **THEN** a section lists teaser cards for published articles, and
  clicking one opens that article

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
