# composition-room Specification

## Purpose

The collaborative-document tool: one shared Strudel script that several
people edit at the same time, character by character, with merged
concurrent edits, editor/viewer roles, live cursors, room-synced
playback, and an ephemeral chat — as distinct from JAM's per-track,
single-owner model.

## Requirements

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
The system SHALL show every participant, within the room's Chat tab, a
live roster of who else is in the room and whether each is an editor
or a viewer, scoped to that room. Each entry SHALL show the
participant's display name and, where they are signed in with a
profile picture, their avatar.

#### Scenario: Roster updates as people come and go
- **WHEN** a participant joins or leaves a Composition Room
- **THEN** every other participant's roster reflects the change,
  including the joiner's or leaver's role

#### Scenario: A signed-in participant shows their avatar
- **WHEN** a participant signed in with a profile picture is in the room
- **THEN** the roster shows their avatar next to their name and role;
  a participant with no picture shows a placeholder, not a broken image

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
The system SHALL provide a text chat, within the room's Chat tab
alongside the participant roster, for the people in the room. Messages
are delivered to everyone currently connected and are not persisted —
chat history is empty after a restart or once the room empties. Each
message SHALL be attributed to the sender's display name and, where
the sender is signed in with a profile picture, their avatar.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name, with the sender's avatar
  when they have one

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat log is empty

### Requirement: Composition Room Presents Three Tabs, One Visible At A Time
The system SHALL organize the Composition Room into exactly three
views — Composition (the shared editor and its visual backdrop), Chat
(the roster and messaging, per the requirements above), and ASCII Art
(per the `ascii-overlay` capability) — presented as tabs, with exactly
one visible at a time. Each participant's active tab is their own,
unsynced choice: switching tabs SHALL NOT change what any other
participant sees. The system SHALL provide a way to switch tabs by
keyboard as well as by pointer. On a narrow viewport the tab switcher
SHALL be reachable at the bottom of the screen; on a wider viewport it
SHALL be reachable from the room's header.

#### Scenario: Switching tabs shows only that view
- **WHEN** a participant switches to a tab
- **THEN** that tab's content is shown and the other two tabs' content
  is not visible

#### Scenario: Two participants can be on different tabs
- **WHEN** one participant is viewing the Chat tab and another is
  viewing the Composition tab in the same room
- **THEN** each sees only their own selected tab; neither's choice
  affects the other

#### Scenario: A tab can be switched without a pointer
- **WHEN** a participant uses the keyboard shortcut for a tab
- **THEN** that tab becomes active, the same as clicking it

#### Scenario: The tab switcher stays reachable on a narrow viewport
- **WHEN** the room is open on a phone-width viewport
- **THEN** the tab switcher is reachable at the bottom of the screen
  and every tab can be activated

### Requirement: Playback State Is Always Visible
The system SHALL show, in the room's header, whether the shared
document is currently playing, regardless of which tab is active.

#### Scenario: Playback stays visible while on a different tab
- **WHEN** the shared document is playing and a participant is on the
  Chat or ASCII Art tab
- **THEN** the header still shows that playback is active

#### Scenario: Stopped state is shown
- **WHEN** the shared document is not playing
- **THEN** the header shows that nothing is currently playing

### Requirement: Inactive Tabs Indicate New Activity
The system SHALL show an indicator on the Chat tab when a chat message
arrives while that tab is not active, and an indicator on the
Composition tab when the shared document is evaluated while that tab
is not active. Both indicators SHALL clear when the participant
switches to the corresponding tab.

#### Scenario: A message arrives while Chat is not active
- **WHEN** a chat message is received while a participant's active tab
  is Composition or ASCII Art
- **THEN** the Chat tab shows an activity indicator until they switch
  to it

#### Scenario: An evaluation happens while Composition is not active
- **WHEN** any participant evaluates the shared document while another
  participant's active tab is Chat or ASCII Art
- **THEN** that participant's Composition tab shows an activity
  indicator until they switch to it

### Requirement: An Editor Can Clear The Shared Document
The system SHALL let a participant with the editor role clear the
shared document, replacing its content with an empty document for
every participant, only after they explicitly confirm the action. A
participant with the viewer role SHALL NOT be able to trigger this
control.

#### Scenario: An editor clears the document after confirming
- **WHEN** an editor triggers the clear control and confirms it
- **THEN** the shared document becomes empty for every participant

#### Scenario: Canceling the confirmation leaves the document untouched
- **WHEN** an editor triggers the clear control but does not confirm it
- **THEN** the shared document is unchanged

#### Scenario: A viewer cannot clear the document
- **WHEN** a participant with the viewer role looks for the clear
  control
- **THEN** they cannot trigger it
