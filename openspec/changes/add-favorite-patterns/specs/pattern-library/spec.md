## MODIFIED Requirements

### Requirement: A Pattern Has Code, Title, Tags, And A Source
The system SHALL represent each curated pattern with a stable
identifier, a human-readable title, the Strudel code itself, zero or
more freeform tags, a creation timestamp, a source attribution
consisting of a URL and an optional author name, and a `favorite`
flag. A pattern's `favorite` flag defaults to false when not set.

#### Scenario: A pattern exposes its fields
- **WHEN** a client fetches a single pattern by its identifier
- **THEN** the response includes the pattern's id, title, code, tags,
  createdAt, source (url and optional author), and favorite flag

#### Scenario: An unknown identifier is rejected
- **WHEN** a client fetches a pattern by an identifier that does not
  exist
- **THEN** the system responds with a not-found error, not an empty
  success

#### Scenario: A pattern with no favorite flag set defaults to not favorite
- **WHEN** a manifest entry or a database row omits a favorite value
- **THEN** the pattern's favorite flag is false

## ADDED Requirements

### Requirement: Patterns Are Filterable By Favorite Status
The system SHALL let a client restrict the listing to patterns whose
`favorite` flag is true, evaluated server-side, combinable with the
existing tag filter and text search.

#### Scenario: Favorite filter narrows the results
- **WHEN** a client requests the list filtered to favorites only
- **THEN** the response contains only patterns with `favorite = true`

#### Scenario: Favorite filter combines with tag and text filters
- **WHEN** a client supplies a favorite filter together with a tag
  filter, a text query, or both
- **THEN** the response contains only patterns satisfying every
  supplied filter

#### Scenario: No favorites yields an empty page, not an error
- **WHEN** a client filters to favorites and no pattern is marked
  favorite
- **THEN** the response is a valid empty page

### Requirement: A Pattern's Code Can Be Opened In strudel.cc
The system SHALL let a user open any pattern's code directly in the
official strudel.cc REPL from wherever that pattern's code is shown or
currently loaded, without a server round-trip.

#### Scenario: Opening a pattern in strudel.cc
- **WHEN** a user triggers "open in strudel.cc" on a pattern whose code
  is shown or currently loaded
- **THEN** a new browser tab opens strudel.cc with that exact code
  ready to play, generated entirely client-side
