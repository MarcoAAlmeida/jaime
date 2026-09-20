## Purpose
Governs how jaime bundles third-party icon sets: locally, with no
runtime dependency on an external API, and with per-icon attribution
tracked wherever a set's license requires it.

## ADDED Requirements

### Requirement: Icons Are Bundled Locally, Not Fetched At Runtime
The system SHALL serve every icon from a locally bundled set, both in
server-rendered and client-rendered output. The system SHALL NOT
depend on a runtime network call to an external icon API to render any
icon, since the deployment environment cannot reach one.

#### Scenario: An icon renders with no external request
- **WHEN** a page that uses an icon from a bundled set is rendered,
  server-side or client-side
- **THEN** the icon appears without any network request to an external
  icon service

### Requirement: Per-Icon Attribution Is Tracked For Attribution-Required Sets
The system SHALL maintain a record of which individual icons are in
use from any bundled set whose license requires per-icon or per-author
attribution (rather than one blanket credit), naming that icon's
specific author. This record SHALL be kept current as icons from such
a set are added to or removed from use.

#### Scenario: Using an icon from an attribution-required set is recorded
- **WHEN** an icon from a set requiring per-icon attribution is added
  to any page or component
- **THEN** that icon and its author appear in the attribution record

#### Scenario: An unused set's attribution record starts empty
- **WHEN** an attribution-required icon set is bundled but no icon from
  it is yet used anywhere in the product
- **THEN** the attribution record for that set exists but lists no
  icons
