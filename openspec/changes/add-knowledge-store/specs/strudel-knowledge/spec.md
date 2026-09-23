## ADDED Requirements

### Requirement: The Corpus Is Held In A Durable, Queryable Store

The system SHALL reconcile the committed knowledge corpus into a durable
store whose contents survive a deploy, such that every chunk in the
corpus file is retrievable by its id or by any of its synonyms. The store
SHALL be rebuildable from the corpus file alone at any time: reconciling
an unchanged file SHALL leave the store in the same state it already had,
and reconciling a changed file SHALL bring the store to exactly match it
— a chunk removed from the file SHALL no longer be retrievable from the
store, and a chunk added or edited in the file SHALL be retrievable with
its new content.

#### Scenario: A chunk is retrievable by its id
- **WHEN** the corpus has been reconciled into the store
- **THEN** looking up any chunk's id from the corpus file returns that
  chunk's current content

#### Scenario: A chunk is retrievable by any of its synonyms
- **WHEN** a function chunk with synonyms has been reconciled into the
  store
- **THEN** looking up any of its synonyms returns that same chunk

#### Scenario: Reconciling an unchanged file changes nothing
- **WHEN** the corpus file has not changed since the last reconcile
- **THEN** reconciling again leaves every chunk's stored content
  identical to what it already was

#### Scenario: A chunk removed from the file is no longer retrievable
- **WHEN** a chunk present in the store is removed from the corpus file
  and the store is reconciled
- **THEN** looking up that chunk's id or synonyms finds nothing

#### Scenario: A chunk edited in the file is updated, not duplicated
- **WHEN** a chunk already in the store has its text changed in the
  corpus file and the store is reconciled
- **THEN** looking up its id returns the new text, and it exists only
  once in the store

### Requirement: Reconciling The Store Runs On Deploy

The system SHALL reconcile the store to the corpus file as part of every
deploy, before the deployed code that would read the store goes live, so
the store is never left behind the corpus file it is reconciled from.
Reconciling SHALL NOT run as part of refreshing the corpus itself, and
SHALL NOT require network access to any documentation source.

#### Scenario: A deploy leaves the store matching the committed file
- **WHEN** a deploy runs with a corpus file different from what the store
  currently holds
- **THEN** the store matches the newly deployed corpus file once the
  deploy completes

#### Scenario: Refreshing the corpus does not itself touch the store
- **WHEN** the corpus file is regenerated (refreshed) but not yet
  deployed
- **THEN** the store is unchanged until a deploy reconciles it
