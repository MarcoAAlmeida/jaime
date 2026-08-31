# hub-mock-screens Specification

## Purpose
Provides non-functional, click-through mock pages for features that
don't exist yet — currently the Composition Room — as real Nuxt pages
with static/mock data, so the screens can be validated before their
backing domain model and persistence land in later phases.

## Requirements

### Requirement: Composition Room Mock Shows Its Core Elements
The system SHALL provide a mock Composition Room page showing a
placeholder shared editor, a mock presence indicator, a viewer/editor
toggle, and an empty chat panel, with none of it backed by real
collaboration.

#### Scenario: Visitor sees the Composition Room mock's elements
- **WHEN** a visitor opens the Composition Room mock page
- **THEN** a placeholder editor, a mock presence indicator, a
  viewer/editor toggle, and an empty chat panel are all visible
