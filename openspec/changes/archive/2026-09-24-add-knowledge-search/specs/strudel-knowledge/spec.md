## ADDED Requirements

### Requirement: A Chunk Is Findable By Meaning, Not Only By Exact Match

The system SHALL support finding chunks by the meaning of a natural-
language query, in addition to exact lookup by id or synonym. A search
SHALL return chunks ranked by relevance to the query and SHALL return
each result's full content, not merely its identifier.

#### Scenario: A vague query returns relevant chunks
- **WHEN** a query names no specific function or exact term but
  describes an intent (for example, a filter-sweep-style effect)
- **THEN** the search returns chunks relevant to that intent, each with
  its full content

#### Scenario: A query with no relevant chunk returns nothing false
- **WHEN** a query has no meaningfully related chunk in the store
- **THEN** the search does not fabricate a result; it returns nothing or
  only genuinely low-relevance matches, distinguishable as such

### Requirement: The Search Index Stays In Exact Agreement With The Corpus

The system SHALL keep the search index in exact agreement with the
corpus file: a chunk added or changed in the corpus SHALL become
findable (or newly reflect its changed content) once reconciled, and a
chunk removed from the corpus SHALL no longer be returned by a search,
once reconciled. Reconciling SHALL NOT re-embed a chunk whose text has
not changed since it was last embedded.

#### Scenario: A new chunk becomes findable after reconciling
- **WHEN** a chunk present in the corpus file is not yet in the search
  index, and the index is reconciled
- **THEN** a query matching that chunk's meaning returns it afterward

#### Scenario: A removed chunk stops being returned
- **WHEN** a chunk is removed from the corpus file and the index is
  reconciled
- **THEN** no search result identifies that chunk any longer

#### Scenario: An unchanged chunk is not re-embedded
- **WHEN** the index is reconciled and a chunk's text has not changed
  since its last successful embedding
- **THEN** that chunk is not sent for embedding again

### Requirement: Search Never Runs Against A Real Index In Automated Tests

The system's automated tests SHALL NOT call a real embedding model or a
real search index. Search SHALL be exercised in tests only through an
injected stub, so that running the test suite neither depends on network
access to a search index nor can affect one.

#### Scenario: The automated tests never reach a real index
- **WHEN** the project's automated tests run
- **THEN** no embedding call and no search-index call reaches a real
  network endpoint; an injected stub stands in for both
