# hub-mock-screens Specification

## Purpose
Provides non-functional, click-through mock pages for features that
don't exist yet — Pattern library, Composition Room, and community
signup — as real Nuxt pages with static/mock data, so the screens can
be validated before their backing domain model and persistence land in
later phases.

## Requirements

### Requirement: Pattern Library Mock Shows Example Patterns
The system SHALL provide a mock Pattern library page displaying a
static list of example patterns with tags, with no real backend
search.

#### Scenario: Visitor browses the mock pattern list
- **WHEN** a visitor opens the Pattern library mock page
- **THEN** a static list of example patterns with tags is visible

### Requirement: Composition Room Mock Shows Its Core Elements
The system SHALL provide a mock Composition Room page showing a
placeholder shared editor, a mock presence indicator, a viewer/editor
toggle, and an empty chat panel, with none of it backed by real
collaboration.

#### Scenario: Visitor sees the Composition Room mock's elements
- **WHEN** a visitor opens the Composition Room mock page
- **THEN** a placeholder editor, a mock presence indicator, a
  viewer/editor toggle, and an empty chat panel are all visible

### Requirement: Community Signup Mock Accepts An Email
The system SHALL provide a mock community signup screen that accepts
an email address and acknowledges submission, without sending a real
confirmation email.

#### Scenario: Visitor submits the mock signup form
- **WHEN** a visitor enters an email and submits the community signup
  mock form
- **THEN** the form acknowledges the submission without sending a real
  confirmation email
