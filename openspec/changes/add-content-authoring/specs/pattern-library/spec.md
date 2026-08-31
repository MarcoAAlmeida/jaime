## ADDED Requirements

### Requirement: The Curated Catalog Is Defined By A Version-Controlled Manifest
The system SHALL treat a manifest checked into the repository as the
single source of truth for which curated patterns exist. Each manifest
entry SHALL carry a stable identifier, a title, the Strudel code, zero
or more tags, and a source attribution (a URL and an optional author).
A manifest entry missing a source SHALL be rejected rather than
imported without attribution.

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

### Requirement: Deploying Reconciles The Catalog To The Manifest
The system SHALL, as part of deployment, bring the curated contents of
the pattern database into exact agreement with the manifest: entries
new to the manifest are added, entries whose fields changed are
updated, and curated entries no longer in the manifest are removed
along with their tags. Reconciling SHALL be idempotent — running it
again with an unchanged manifest makes no further changes.

#### Scenario: A new manifest entry appears in the library after deploy
- **WHEN** an entry is added to the manifest and the application is
  deployed
- **THEN** the pattern list returns that pattern, with its manifest
  fields, and no reseeding step is required

#### Scenario: An edited manifest entry is updated in place
- **WHEN** an existing entry's code, title, tags, or source is changed
  in the manifest and the application is deployed
- **THEN** the catalog returns the updated fields for that pattern,
  under the same identifier

#### Scenario: A removed manifest entry leaves the library
- **WHEN** a curated entry is deleted from the manifest and the
  application is deployed
- **THEN** that pattern and its tags are gone from the catalog, and
  fetching it by id returns not-found

#### Scenario: Reconciling twice changes nothing the second time
- **WHEN** a deploy reconciles the catalog and then the same manifest
  is reconciled again
- **THEN** the second reconcile reports no inserts, updates, or
  removals

### Requirement: Reconciling Does Not Touch Non-Curated Patterns
The system SHALL limit manifest reconciliation to curated patterns.
Patterns created through any other path (for example, user-authored
patterns) SHALL be left unchanged by a reconcile, whether or not they
appear in the manifest.

#### Scenario: A user-authored pattern survives a reconcile
- **WHEN** the catalog contains a non-curated pattern and a deploy
  reconciles the manifest, which does not list that pattern
- **THEN** the non-curated pattern is still present and unchanged after
  the deploy
