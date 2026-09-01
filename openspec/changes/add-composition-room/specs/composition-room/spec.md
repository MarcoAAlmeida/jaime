## Purpose

The collaborative-document tool: one shared Strudel script that several
people edit at the same time, character by character, with merged
concurrent edits, editor/viewer roles, live cursors, room-synced
playback, and an ephemeral chat — as distinct from JAM's per-track,
single-owner model.

## ADDED Requirements

### Requirement: Create A Composition Room
The system SHALL let anyone create a new Composition Room without an
account, producing a room with its own stable id and a shareable link.

#### Scenario: A visitor starts a room
- **WHEN** a person with no account creates a Composition Room
- **THEN** they land in a room with an empty-or-starter shared
  document and a link they can copy to invite others

### Requirement: Join A Composition Room By Link
The system SHALL let a person open a Composition Room's link and join
the same room, seeing the current shared document and everyone present.

#### Scenario: A second person joins the link
- **WHEN** a person opens a Composition Room link that someone else
  created
- **THEN** they see that room's current document content and the
  existing participants' presence

#### Scenario: The same id is the same room
- **WHEN** two people open the same Composition Room link at different
  times
- **THEN** they are in the same room, over the same document

### Requirement: Choose Editor Or Viewer On Join
The system SHALL let each joiner declare themselves an editor or a
viewer. The choice is self-declared — one link, no server-enforced
access control — and can be changed while in the room.

#### Scenario: Joining as a viewer
- **WHEN** a person joins a Composition Room and picks the viewer role
- **THEN** they see the live document and hear playback, and their
  role is shown to others as "viewer"

#### Scenario: Switching role in-room
- **WHEN** a participant switches between editor and viewer while in
  the room
- **THEN** their editing ability and the role others see for them
  update immediately, with no rejoin

### Requirement: A Viewer's Editor Is Strictly Read-Only
The system SHALL prevent a viewer from changing the shared document —
their editor accepts navigation and selection but not edits, and no
edit from a viewer reaches other participants.

#### Scenario: A viewer cannot type into the document
- **WHEN** a viewer attempts to type, paste, or otherwise edit the
  shared document
- **THEN** the document is unchanged for them and for everyone else

### Requirement: Concurrent Edits Merge
The system SHALL merge simultaneous edits from multiple editors into one
converging document — never last-write-wins, never a silent overwrite
of another editor's change. All editors' documents converge to the same
content once edits have propagated.

#### Scenario: Two editors type in different places at once
- **WHEN** two editors insert text at different positions in the same
  cycle
- **THEN** both insertions survive, and every participant's document
  ends up identical

#### Scenario: Two editors change the same line
- **WHEN** two editors edit the same region concurrently
- **THEN** the edits are reconciled into a single result that every
  participant converges on, with neither edit lost without a trace

#### Scenario: An editor's in-flight edits are preserved across a remote change
- **WHEN** an editor has local unsent edits and a remote change arrives
- **THEN** the local edits are rebased onto the remote change and
  remain in the document

### Requirement: The Shared Document Persists Across Restarts
The system SHALL persist a Composition Room's document so that its
content survives a Worker restart. Presence and chat SHALL NOT persist —
they are rebuilt from whoever is connected now.

#### Scenario: Document is intact after a restart
- **WHEN** every participant disconnects, the room's Worker restarts,
  and someone reopens the link
- **THEN** the document has the content it had before, and the
  presence list and chat history start empty

### Requirement: Presence Shows Who Is In The Room And Their Role
The system SHALL show every participant a live roster of who else is in
the room and whether each is an editor or a viewer, scoped to that room.

#### Scenario: Roster updates as people come and go
- **WHEN** a participant joins or leaves a Composition Room
- **THEN** every other participant's roster reflects the change,
  including the joiner's or leaver's role

### Requirement: Editors See Each Other's Live Cursor And Selection
The system SHALL show each editor the caret position and selection of
every other editor, distinguished per person (name and colour), updated
live as they move, and correctly positioned as the document changes.

#### Scenario: A remote caret tracks edits
- **WHEN** one editor moves their cursor and another editor then
  inserts text before that position
- **THEN** the first editor's caret, as shown to the second, stays on
  the same logical character rather than drifting

#### Scenario: Cursors disappear when an editor leaves
- **WHEN** an editor disconnects
- **THEN** their cursor and selection are removed from every other
  editor's view

### Requirement: Evaluating The Document Plays It For The Whole Room In Sync
The system SHALL, when a participant evaluates the shared document,
broadcast that evaluation so every connected client — editors and
viewers — plays the current document locked to the room's shared
transport clock, hearing the same audio in time.

#### Scenario: One editor evaluates, everyone hears it together
- **WHEN** an editor evaluates the shared document
- **THEN** every participant's client plays that document, aligned to
  the room's transport clock so the parts line up across clients

#### Scenario: A late joiner catches the running playback
- **WHEN** a person joins a room whose document is already playing
- **THEN** their client starts playing the current document aligned to
  the same transport clock, without another evaluation

#### Scenario: A pattern error is surfaced, playback stays usable
- **WHEN** an evaluated document contains a Strudel error
- **THEN** the error is shown in the room's editor and the audio
  engine stays usable for the next evaluation

### Requirement: Ephemeral Room Chat
The system SHALL provide a text chat beside the editor for the people
in the room. Messages are delivered to everyone currently connected and
are not persisted — chat history is empty after a restart or once the
room empties.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat panel is empty
