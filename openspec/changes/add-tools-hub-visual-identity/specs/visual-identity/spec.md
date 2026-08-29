## Purpose

Defines jaime's light/dark-mode color identity — the pastel-beige
light background and near-black graphite dark background — applied
consistently across every layout shell, so the new hub reads as its
own product rather than default Nuxt UI styling.

## ADDED Requirements

### Requirement: Light Mode Uses Pastel Beige Background
The system SHALL render a pastel light-beige background in light mode,
matching `design/assets/jaime-logo.jpg`, not plain white.

#### Scenario: Light mode background is pastel beige
- **WHEN** a user views any page of the app in light mode
- **THEN** the page background renders as pastel light-beige, not white

### Requirement: Dark Mode Uses Graphite Background
The system SHALL render a near-black `graphite` neutral background in
dark mode, not navy or any blue-tinted neutral.

#### Scenario: Dark mode background is graphite, not navy
- **WHEN** a user views any page of the app in dark mode
- **THEN** the page background renders as near-black graphite, with no
  navy or blue tint
