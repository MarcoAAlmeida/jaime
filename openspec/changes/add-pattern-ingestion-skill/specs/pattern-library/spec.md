## MODIFIED Requirements

### Requirement: The Curated Catalog Is Defined By A Version-Controlled Manifest
The system SHALL treat a manifest checked into the repository as the
single source of truth for which curated patterns exist. Each manifest
entry SHALL carry a stable identifier, a title, the Strudel code, zero
or more tags, and a source attribution (a URL and an optional author).
A manifest entry missing a source SHALL be rejected rather than
imported without attribution. An entry's code SHALL reach the catalog
exactly as written in the manifest, including code that itself contains
lines of triple backticks.

#### Scenario: A manifest entry fully describes a curated pattern
- **WHEN** the manifest lists an entry with an id, title, code, tags,
  and source
- **THEN** that pattern is available from the catalog with exactly
  those fields, including its source shown wherever its code is shown

#### Scenario: An entry with no source is refused
- **WHEN** the manifest contains an entry that omits a source URL
- **THEN** the reconcile fails and reports the offending entry, and the
  catalog is left unchanged

#### Scenario: Two entries sharing an id are refused
- **WHEN** the manifest contains two entries with the same identifier
- **THEN** the reconcile fails and reports the duplicate, and the
  catalog is left unchanged

#### Scenario: Code containing triple backticks is not truncated
- **WHEN** an entry's code contains a line of triple backticks
- **THEN** the catalog holds the entry's complete code, not the part
  before that line
