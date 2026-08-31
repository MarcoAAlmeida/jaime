# pattern-library Specification

## Purpose
The durable, curated catalog of Strudel patterns — a place to find a
starting point instead of a blank editor. Defines what a Pattern is,
that the catalog persists across deploys, and how it is browsed,
searched, attributed, and previewed.

## Requirements

### Requirement: Catalog Persists Across Deploys
The system SHALL store curated patterns in a durable database whose
schema is version-controlled, such that the catalog's contents survive
a redeploy and a Worker restart.

#### Scenario: Patterns are still there after a redeploy
- **WHEN** the application is redeployed
- **THEN** the pattern library returns the same set of curated patterns
  it returned before, with no reseeding required

#### Scenario: Schema changes are applied in order
- **WHEN** a new database migration is added and the application is
  deployed
- **THEN** the migration is applied exactly once, in sequence with
  prior migrations, and the deploy fails rather than serving against an
  un-migrated schema

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

### Requirement: A Pattern Has Code, Title, Tags, And A Source
The system SHALL represent each curated pattern with a stable
identifier, a human-readable title, the Strudel code itself, zero or
more freeform tags, a creation timestamp, and a source attribution
consisting of a URL and an optional author name.

#### Scenario: A pattern exposes its fields
- **WHEN** a client fetches a single pattern by its identifier
- **THEN** the response includes the pattern's id, title, code, tags,
  createdAt, and source (url and optional author)

#### Scenario: An unknown identifier is rejected
- **WHEN** a client fetches a pattern by an identifier that does not
  exist
- **THEN** the system responds with a not-found error, not an empty
  success

### Requirement: The Library Is Browsable As A Paginated List
The system SHALL return curated patterns as a list that is paginated,
so a client can retrieve the catalog in bounded chunks with a stable
order across pages.

#### Scenario: Default listing returns a bounded first page
- **WHEN** a client requests the pattern list with no pagination
  parameters
- **THEN** it receives at most one page of patterns plus enough
  information to request the next page

#### Scenario: Paging through the catalog covers every pattern once
- **WHEN** a client requests successive pages until the list is
  exhausted
- **THEN** every curated pattern appears exactly once across the pages,
  with no duplicates or omissions

### Requirement: Patterns Are Filterable By Tag
The system SHALL let a client restrict the listing to patterns carrying
one or more specified tags, evaluated server-side.

#### Scenario: Tag filter narrows the results
- **WHEN** a client requests the list filtered to a tag that only some
  patterns carry
- **THEN** the response contains only patterns carrying that tag, and
  pagination reflects the filtered count

#### Scenario: An unmatched tag yields an empty page
- **WHEN** a client filters by a tag no pattern carries
- **THEN** the response is a valid empty page, not an error

### Requirement: Patterns Are Searchable By Text
The system SHALL let a client search patterns by a free-text query,
evaluated server-side, matching against at least the pattern's title
and tags.

#### Scenario: Text search returns relevant patterns
- **WHEN** a client searches for a term that appears in some patterns'
  titles or tags
- **THEN** the response contains those patterns and excludes patterns
  that match nowhere

#### Scenario: Text search and tag filter combine
- **WHEN** a client supplies both a text query and a tag filter
- **THEN** the response contains only patterns satisfying both, with
  pagination over that combined result

### Requirement: Each Pattern Credits Its Source
The system SHALL surface every pattern's source attribution wherever
the pattern's code is shown to a user, so that credit is visible at the
point of use, not buried.

#### Scenario: Attribution is shown with the pattern
- **WHEN** a user views a pattern's code in the library
- **THEN** the pattern's source is shown alongside it, linking to the
  source URL and naming the author when one is recorded

### Requirement: A Pattern Can Be Previewed As Sound
The system SHALL let a user hear a pattern by running its code in the
browser from the library, without loading it into a separate tool and
without any server-side audio.

#### Scenario: Previewing plays the pattern
- **WHEN** a user triggers preview on a pattern in the library
- **THEN** the pattern's code is evaluated and played locally, and the
  user can stop it

#### Scenario: A broken pattern surfaces its error
- **WHEN** a user previews a pattern whose code fails to evaluate
- **THEN** the library shows the evaluation error rather than failing
  silently

### Requirement: A Pattern Can Be Loaded Into JAM
The system SHALL let a user send a chosen library pattern into JAM,
where it becomes the code of a track that user owns, so they can start
from that pattern instead of retyping it.

#### Scenario: Loading a pattern opens a JAM room with it in place
- **WHEN** a user triggers "load into JAM" on a library pattern
- **THEN** a new JAM room opens with that user in it, and once they own
  a track that track's code is the chosen pattern's code

#### Scenario: The loaded pattern is editable and playable like any other
- **WHEN** a user has loaded a pattern into their JAM track
- **THEN** they can edit it and play it with no difference from a
  pattern they typed themselves

#### Scenario: Loading does not require signing up
- **WHEN** an anonymous user triggers "load into JAM"
- **THEN** they reach the room with the pattern loaded, with no signup
  gate
