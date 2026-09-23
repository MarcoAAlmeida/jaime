# strudel-knowledge Specification

## Purpose

Turns Strudel's own documentation — JSDoc comments in its source and the
prose pages of its documentation site, both read from the `refers_to/strudel`
git submodule at a pinned commit — into a versioned, attributed, validated
set of knowledge chunks that later phases of `docs/04-roadmap/jah-intelligence/`
load into a runtime store and use to ground `@jah`'s replies. It is a
developer workflow, refreshed rarely and deliberately; it does not run at
deploy time and it does not, by itself, change anything `@jah` says.

## Requirements

### Requirement: The Corpus Is Built From The Pinned Submodule, Never Scraped

The workflow SHALL read Strudel's documentation only from the
`refers_to/strudel` git submodule, at whatever commit it is currently
pinned to, and SHALL NOT fetch documentation from strudel.cc or any other
live source. When the submodule's working tree is not present or not
initialized at the pinned commit, the workflow SHALL initialize or update
it to that commit before doing anything else, rather than proceeding
against stale or absent content.

#### Scenario: The submodule is not yet checked out
- **WHEN** a refresh is run and `refers_to/strudel` has no working tree
- **THEN** the workflow initializes it at the commit `.gitmodules` and the
  submodule's own pinned SHA specify, before extracting anything

#### Scenario: Nothing is ever fetched from strudel.cc
- **WHEN** a refresh runs
- **THEN** no network request is made to strudel.cc or any documentation
  site; the submodule's checked-out files are the only source read

### Requirement: Function Documentation Is Extracted With Strudel's Own Tooling

The workflow SHALL extract function documentation by running the
submodule's own JSDoc pipeline (its `jsdoc`/`jsdoc-json` scripts and its
`jsdoc/jsdoc.config.json`) against its `packages/` directory, producing one
doclet per documented function with at least its name, description,
parameters, and any declared examples. The workflow SHALL NOT re-implement
JSDoc comment parsing.

#### Scenario: A documented function's signature and example are captured
- **WHEN** the submodule documents a function with `@name`, `@param`, and
  `@example` tags
- **THEN** the extracted doclet for that function carries its name, its
  parameter names and descriptions, and its example code exactly as
  written

### Requirement: A Function's Synonyms And Tags Are Preserved

When a documented function declares synonyms (alternate names for the same
function) or tags (topical keywords), the corresponding chunk SHALL record
them. A synonym SHALL be treated as another name that resolves to the same
chunk.

#### Scenario: A function with synonyms resolves under any of its names
- **WHEN** a function is documented with one or more synonyms
- **THEN** the chunk built for it records every synonym, and looking it up
  by any synonym finds that same chunk

#### Scenario: A function's declared tags are recorded
- **WHEN** a function's documentation declares one or more tags
- **THEN** the chunk built for it records those tags

### Requirement: Every Chunk Shares One Taxonomy

Every knowledge chunk, regardless of whether it documents a function, a
concept, or an example, SHALL carry: a stable identifier, a `kind` of
`function`, `concept`, or `example`, a title, a category, zero or more
tags, its text, a source location (the file path within the submodule at
the pinned commit), a license, and a version (the submodule's commit and,
where applicable, the documented package's version). A `function` chunk
SHALL additionally carry its synonyms, its parameters, and its examples.

#### Scenario: A function chunk carries the full shared schema
- **WHEN** a function chunk is built
- **THEN** it has an id, kind `function`, a title, a category, a source
  location naming the file it came from within the submodule, a license,
  and a version, in addition to its synonyms, parameters, and examples

#### Scenario: A concept chunk uses the same shared fields
- **WHEN** a concept chunk is built from a documentation page's prose
- **THEN** it has the same id/kind/title/category/tags/text/source/
  license/version fields, with kind `concept`

### Requirement: A Function's Category Comes From The Documentation Site's Own Structure

The workflow SHALL derive a documented function's category from the
documentation site's page structure within the submodule: a page's title
becomes the category of every function that page presents. A function
that no page presents SHALL still produce a chunk, with its category
derived from its source location instead, and SHALL be listed among the
run's reported gaps rather than silently included as if fully categorized
or silently dropped.

#### Scenario: A function shown on a documentation page inherits its category
- **WHEN** a documentation page titled "Time Modifiers" presents a
  function
- **THEN** that function's chunk has category "Time Modifiers"

#### Scenario: A function with no page falls back and is reported
- **WHEN** a documented function is not presented on any documentation
  page
- **THEN** its chunk is still built, with a category derived from its
  source file, and it is named in the run's gap report

### Requirement: Concept And Example Chunks Come From The Documentation Pages' Prose

The workflow SHALL build concept chunks from the prose sections of the
documentation pages, split by heading, with the pages' own import and
component syntax removed and any fenced code kept intact. It SHALL build
example chunks from the runnable code examples embedded in those pages. A
page written in a language other than English SHALL be excluded from
concept and example extraction.

#### Scenario: A prose section becomes a self-contained concept chunk
- **WHEN** a documentation page has a heading followed by explanatory
  prose and a fenced code example
- **THEN** a concept chunk is built from that section with the page's
  import/component syntax removed and the fenced code preserved

#### Scenario: A non-English page is excluded
- **WHEN** the documentation pages include a translated copy of a page
- **THEN** no concept or example chunk is built from the translated copy

### Requirement: Documented Gaps Are Reported, Not Hidden

The workflow SHALL read the submodule's own record of undocumented
exports and include it, unchanged in meaning, in the run's report. The
workflow SHALL NOT present the corpus as covering more of Strudel than it
does.

#### Scenario: Undocumented exports are named in the report
- **WHEN** a refresh completes and the submodule records exports with no
  documentation
- **THEN** the run's report names them, separately from the chunks that
  were built

### Requirement: Every Example Is Validated Against Real Evaluation And Against Strudel's Own Recorded Output

For every function example and every extracted example chunk, the
workflow SHALL evaluate its code with the same headless evaluator the
curated pattern library's fast check uses, and SHALL additionally compare
its outcome, where the submodule records one, against Strudel's own
recorded expected output for that exact example. A mismatch between this
evaluation, or Strudel's own recorded output, and what the chunk's code
actually does when evaluated here SHALL be reported by the example's
name and location, and SHALL NOT be silently excluded from the corpus or
silently treated as passing.

#### Scenario: An example that matches Strudel's own recorded output is unremarkable
- **WHEN** an example evaluates here to the same result Strudel's own
  records show for it
- **THEN** it is included in the corpus with no note

#### Scenario: An example that evaluates differently here is reported, not hidden
- **WHEN** an example evaluates to a different result here than Strudel's
  own records show for it
- **THEN** the run's report names the example and the discrepancy, and the
  example is still included in the corpus rather than silently dropped

#### Scenario: An example that raises an error is reported
- **WHEN** an example's code raises an error when evaluated
- **THEN** the run's report names the example and the error

### Requirement: Every Chunk Records Its Attribution

Every chunk SHALL record the license governing its source (`AGPL-3.0`)
and a version identifying exactly which submodule commit, and where
applicable which Strudel package version, it was built from. A chunk's
`source_url` SHALL identify the specific file within the submodule it was
built from.

#### Scenario: A chunk's provenance is fully recorded
- **WHEN** any chunk is built
- **THEN** it records the license, the version, and the specific source
  file it came from

### Requirement: Refreshing Is A Deliberate, Offline-Safe, Developer-Run Act

The workflow SHALL run only when a developer explicitly invokes it, and
SHALL NOT be invoked by an automated deploy or by continuous integration.
Its output SHALL be written to one committed location whose changes are
reviewable as an ordinary file diff. The workflow's own automated tests
SHALL run without the submodule present, using fixture input, so that a
fresh clone or a continuous-integration run that has not initialized the
submodule can still verify the extraction and chunking logic.

#### Scenario: A refresh is never triggered by deploying
- **WHEN** the application is deployed
- **THEN** no refresh of the knowledge corpus runs and the submodule is
  not contacted

#### Scenario: The workflow's tests do not require the submodule
- **WHEN** the workflow's own automated tests run with the submodule not
  checked out
- **THEN** they still pass, using fixture documentation input in place of
  the submodule


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
