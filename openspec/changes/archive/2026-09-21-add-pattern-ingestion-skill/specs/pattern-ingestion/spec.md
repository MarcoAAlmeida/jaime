## Purpose

Governs how a Strudel pattern gets from an external source into the
curated Pattern Library: what a developer can hand over, how it is
turned into code, what must be true before it is added (it plays, its
source is recorded, its attribution has been judged), and that once the
developer approves a review of exactly what will happen, the patterns are
committed and pushed (CI deploys). It is a developer workflow
supported by a Claude Code skill, not a runtime feature of the product.

## ADDED Requirements

### Requirement: Ingestion Starts From A Concrete Source

The workflow SHALL start from a concrete resource the developer supplies:
a strudel.cc link, a URL to a file, gist or documentation page, a GitHub
repository or directory, a local file, or pasted code together with where
it came from. When the developer asks for patterns without supplying such
a resource (for example "add some songs by a band"), the workflow SHALL
ask for one and SHALL NOT go searching for or inventing sources. A
resource that is not Strudel code SHALL be declined, with the reason.

#### Scenario: A concrete link is accepted

- **WHEN** the developer supplies a strudel.cc link, a raw or gist URL, a
  repository URL, a local file path, or pasted code with its origin
- **THEN** the workflow proceeds to resolve it

#### Scenario: An open-ended request asks for a source

- **WHEN** the developer asks to add patterns but supplies no resource
- **THEN** the workflow asks for a link, repository, file or pasted code,
  and adds nothing

#### Scenario: Non-Strudel code is declined

- **WHEN** the supplied resource contains code for another live-coding
  system
- **THEN** the workflow says so and adds nothing

### Requirement: A Source Is Resolved To Code Or Reported As Unresolvable

The workflow SHALL turn each supplied source into Strudel code, whether
the link carries the code in itself, refers to code stored elsewhere, or
points at a repository or directory holding many patterns. When a source
cannot be resolved, the workflow SHALL say why and offer another way
forward (reading the page directly, or the developer pasting the code),
rather than failing silently or guessing.

#### Scenario: A link that carries its code is decoded

- **WHEN** the developer supplies a link whose code is encoded in the link
  itself
- **THEN** the code is recovered without contacting the site

#### Scenario: A link that only refers to stored code is followed

- **WHEN** the developer supplies a short link that holds only an
  identifier for code stored by the site
- **THEN** the workflow retrieves the stored code, including any header
  comment naming title and author

#### Scenario: A repository or directory yields many candidates

- **WHEN** the developer supplies a repository or directory
- **THEN** every Strudel file in it becomes a candidate, and files that
  are evidently not standalone patterns are identified as such

#### Scenario: An unresolvable source is reported

- **WHEN** a source cannot be turned into code
- **THEN** the workflow states the reason and asks the developer how to
  proceed, and adds nothing for that source

### Requirement: Original Code Is Preserved As Written

The workflow SHALL store a pattern's code as found: comments, header
blocks and formatting are kept, and the only changes allowed are
normalising line endings to line feeds and trimming blank space at the
very start and end. Code that itself contains triple backticks SHALL be
stored and read back unchanged.

#### Scenario: Comments and formatting survive

- **WHEN** a pattern with a header comment, custom indentation and blank
  lines is added
- **THEN** the stored code is identical to the source apart from line
  endings and leading or trailing blank space

#### Scenario: Code containing triple backticks is not truncated

- **WHEN** a pattern's code contains a line of triple backticks
- **THEN** the whole code is stored and is read back complete

### Requirement: Every Pattern Records Its Source

The workflow SHALL record where each pattern came from. For a pattern
found in a repository the branch URL of the file is sufficient; where the
pattern is also available on strudel.cc, that link is preferred, but
being unable to find one is not a failure. When the developer pastes code
without saying where it came from, the workflow SHALL ask for a source
URL and SHALL NOT add the pattern without one.

#### Scenario: A repository file records its URL

- **WHEN** a pattern is added from a file in a repository
- **THEN** its recorded source is that file's URL on the repository's
  branch

#### Scenario: A strudel.cc link is kept when there is one

- **WHEN** the same pattern is reachable both as a strudel.cc link and
  elsewhere
- **THEN** the strudel.cc link is recorded, unless the developer says
  otherwise

#### Scenario: Pasted code needs a source

- **WHEN** the developer pastes code and gives no origin
- **THEN** the workflow asks where it came from and adds nothing until it
  has a URL

### Requirement: Attribution Is Judged, And Doubt Goes To The Developer

The workflow SHALL identify each pattern's author from what the source
offers — header comments, repository, page. When the author is unclear or
ambiguous (for example a script's author versus the artist of the piece it
transcribes, or several names), the workflow SHALL ask the developer,
offering reasonable options, and SHALL use their answer. A pattern's
licence SHALL NOT decide whether it is added; attribution is given by
recording the source.

#### Scenario: A clear author is recorded

- **WHEN** a source names a single evident author
- **THEN** that author is proposed without needing to ask

#### Scenario: An ambiguous author is put to the developer

- **WHEN** a source could credit more than one person or act
- **THEN** the workflow asks, with options, and records the developer's
  choice

#### Scenario: Licence does not block

- **WHEN** a source carries a licence, or none
- **THEN** the pattern is handled the same way, with its source recorded

### Requirement: Nothing Is Added Unless It Plays

The workflow SHALL run each candidate in the real playback engine and
SHALL add only a pattern that evaluates without error and whose every
sound is loaded. A failing candidate SHALL be reported with the reason and
not written; the developer decides what to do about it. A candidate that
depends on code outside its own file SHALL be reported as such, and the
workflow SHALL ask the developer how to proceed (for example skip it, or
include the missing code) rather than deciding.

#### Scenario: A passing pattern is eligible

- **WHEN** a candidate evaluates without error and all its sounds exist
- **THEN** it is eligible to be added

#### Scenario: A pattern with an eval error is not written

- **WHEN** a candidate fails to evaluate
- **THEN** it is reported with the error and is not written

#### Scenario: A silent pattern is not written

- **WHEN** a candidate asks for a sound that is not loaded
- **THEN** it is reported with the sound's name and is not written

#### Scenario: An outside dependency is reported and asked about

- **WHEN** a candidate uses something defined outside its file
- **THEN** the workflow reports the dependency and asks the developer
  what to do, and writes nothing for that candidate until they answer

### Requirement: The Developer Reviews Before Anything Is Written

The workflow SHALL present what it proposes to add in one review — for
each item its identifier, title, tags, author, source, check result and
whether it is a favourite — and SHALL write nothing until the developer
approves, accepting their edits. The review SHALL also say what will
happen on approval: which files are created or updated, which tags are new,
and that the files will be committed and pushed, which deploys them. Tags SHALL be reused
from the library's existing tags wherever they fit, and any new tag SHALL
be shown as new. A batch (such as a repository) SHALL be reviewed
together, not one item at a time.

#### Scenario: One review for a batch

- **WHEN** a repository yields many candidates
- **THEN** the developer sees them together in one review and approves,
  edits or drops items before anything is written

#### Scenario: Existing tags are reused

- **WHEN** a candidate fits an existing tag
- **THEN** that tag is proposed rather than a new near-duplicate

#### Scenario: Nothing is written without approval

- **WHEN** the developer has not approved the review
- **THEN** no pattern file is created or changed

#### Scenario: The review says what will happen

- **WHEN** the review is shown
- **THEN** it names the files to be created or updated, marks any new
  tags, and states that approval will commit and push them, which deploys

#### Scenario: Other unpushed commits are named

- **WHEN** other commits are waiting to be pushed and would deploy
  together with the patterns
- **THEN** the review names them before approval

### Requirement: Adding Is Repeatable Without Duplicating

The workflow SHALL recognise a pattern already in the library by its
recorded source, so that running it again on the same source updates the
existing entry, or does nothing if it is unchanged, instead of adding a
duplicate. An existing pattern's identifier SHALL NOT change.

#### Scenario: Re-running on the same source does not duplicate

- **WHEN** the workflow is run again on a source it has already added
- **THEN** no second entry is created

#### Scenario: A changed source updates in place

- **WHEN** the source's code has changed since it was added
- **THEN** the developer is shown the difference and, if approved, the
  existing entry is updated under the same identifier

### Requirement: An Approved Review Is Committed And Pushed

Until the developer approves the review, the workflow SHALL change nothing
beyond temporary local check data that is removed again. Once they approve
it, the workflow SHALL write the pattern files, commit only those files
and push them — the push is the deploy, run by CI — then report what
was pushed and stop. It SHALL NOT run a deploy script by hand, SHALL NOT
write to a remote database itself (CI's deploy reconciles it), and SHALL
NOT keep watching the deploy or the live site afterwards; the developer
reports if a pattern does not appear or the build breaks.

#### Scenario: Nothing ships before approval

- **WHEN** the developer has not approved the review
- **THEN** no pattern file is written, nothing is committed and nothing
  is pushed

#### Scenario: An approved batch is committed and pushed

- **WHEN** the developer approves the review
- **THEN** only the pattern files are committed and pushed, CI deploys, and
  the workflow reports what was pushed

#### Scenario: The workflow stops after the push

- **WHEN** the push has been made
- **THEN** the workflow does not poll the live site or the build; it looks
  into a missing pattern or a broken build only when the developer says so

#### Scenario: No manual deploy

- **WHEN** the workflow ships patterns
- **THEN** it does not run a deploy script by hand; the push is the deploy

### Requirement: Favourites Are Set Only On Request

The workflow SHALL mark a pattern as a favourite only when the developer
asks for it. A favourite then appears in the Composition Room's starter
picker and on the homepage without any further step. A pattern that passes
the playback check meets the bar; the workflow SHALL NOT impose further
tests of its quality.

#### Scenario: Not a favourite by default

- **WHEN** the developer adds a pattern without asking for a favourite
- **THEN** the pattern is not marked as a favourite

#### Scenario: A requested favourite needs nothing more

- **WHEN** the developer asks for a passing pattern to be a favourite
- **THEN** it is marked as one and no additional checks are run

### Requirement: The Workflow Does Only What Was Asked

The workflow SHALL do what its steps and the developer's request call for
and nothing more. When it considers an extra check, change or approach
worthwhile, it SHALL ask the developer first and wait for the answer.

#### Scenario: An extra step is proposed, not taken

- **WHEN** the workflow thinks an additional check or change would help
- **THEN** it asks the developer and does not do it until they agree
