# dashboard-shell Specification

## Purpose
Provides the tools shell — persistent sidebar navigation to Home, the
Composition Room, and Patterns, with JAM as a demoted entry — that the
rooms live inside, distinct from the full-layout-swap docs shell.

## Requirements

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

### Requirement: Active Tool Is Highlighted
The system SHALL visually indicate which tool the sidebar's current
selection corresponds to.

#### Scenario: Current tool is visibly marked
- **WHEN** a user is on a tool's page inside the dashboard shell
- **THEN** that tool's sidebar entry is visibly marked as active

### Requirement: Switching Tools Preserves The Shell
The system SHALL navigate between tools without a full page reload of
the dashboard chrome.

#### Scenario: Tool switch keeps the sidebar mounted
- **WHEN** a user clicks a different tool in the sidebar
- **THEN** the new tool's content loads while the sidebar remains
  mounted, without a full browser navigation/reload

### Requirement: Home Fully Swaps To The Docs Shell
The system SHALL replace the dashboard chrome entirely with the docs
shell when a user selects Home from the sidebar.

#### Scenario: Selecting Home leaves the dashboard chrome
- **WHEN** a user clicks Home in the dashboard sidebar
- **THEN** the dashboard sidebar/chrome is replaced by the docs shell,
  not nested inside it

### Requirement: JAM Is Served From The Dashboard
The system SHALL serve JAM's create/join screen from its entry inside
the dashboard shell.

#### Scenario: JAM sidebar entry opens the real JAM tool
- **WHEN** a user clicks JAM in the dashboard sidebar
- **THEN** JAM's create/join screen loads inside the dashboard shell
