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

### Requirement: Every Joiner Is Automatically An Editor
The system SHALL assign the editor role to every participant
automatically on join — whether creating a room or opening a shared
link — with no self-declared choice and no UI step for it. This is
fixed for the rest of that session.

#### Scenario: Creating a room makes you an editor
- **WHEN** a person creates a new Composition Room
- **THEN** they are an editor in that room, with no role prompt shown

#### Scenario: Joining a shared link makes you an editor
- **WHEN** a person opens a Composition Room's link
- **THEN** they are an editor in that room, with no role prompt shown

#### Scenario: Role is fixed for the session
- **WHEN** a participant has joined a Composition Room
- **THEN** their editor role does not change for the rest of that
  session

### Requirement: A Composition Room Can Be Seeded From A Library Pattern
The system SHALL let a brand-new Composition Room's shared document be
seeded with a specific pattern-library pattern's code instead of the
generic starter document, when the room was created for that purpose.

#### Scenario: A room created from a pattern starts with that code
- **WHEN** a person creates a Composition Room for a specific
  library pattern
- **THEN** the room's shared document starts as that pattern's code
  rather than the generic starter document

#### Scenario: Only the room's first entrant seeds it
- **WHEN** a second person joins that same room after it already has
  content
- **THEN** the document is unchanged by their arrival — no duplicate
  seeding occurs

#### Scenario: The invite link stays clean
- **WHEN** a Composition Room has been seeded from a library pattern
- **THEN** the room's address no longer names that pattern, so a
  copied invite link and the browser's address bar are both clean

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
the sender is signed in with a profile picture, their avatar. `@jah`
(see the `jah-chat` capability) is a possible sender, attributed the
same way with its own avatar.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name, with the sender's avatar
  when they have one

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat log is empty

#### Scenario: An @jah reply is chat like any other
- **WHEN** `@jah` replies in a room
- **THEN** its reply is delivered to everyone currently connected the
  same way a human's message is, and does not survive the room emptying
  or a restart any differently

### Requirement: Composition Room Presents Three Tabs, One Visible At A Time
The system SHALL organize the Composition Room into exactly three
views — Chat (the roster and messaging, per the requirements above),
Composition (the shared editor and its visual backdrop), and ASCII Art
(per the `ascii-overlay` capability) — presented as tabs, in that
order, with exactly one visible at a time. Each participant's active
tab is their own, unsynced choice: switching tabs SHALL NOT change what
any other participant sees. The system SHALL provide a way to switch
tabs by keyboard as well as by pointer. On a narrow viewport the tab
switcher SHALL be reachable at the bottom of the screen; on a wider
viewport it SHALL be reachable from the room's header.

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

### Requirement: Chat Is The Default Tab On Room Entry
The system SHALL show the Chat tab as the active tab from the moment a
participant enters a Composition Room — whether by creating it or by
opening its link — rather than Composition or ASCII Art. This is only
the starting tab: it does not constrain what a participant switches to
afterward.

#### Scenario: Creating a room opens on Chat
- **WHEN** a person creates a new Composition Room
- **THEN** the Chat tab is active as soon as they land in the room

#### Scenario: Joining a room opens on Chat
- **WHEN** a person opens a Composition Room's link
- **THEN** the Chat tab is active as soon as they land in the room,
  regardless of which tab other participants currently have active

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

### Requirement: Three-zone header layout
The Composition Room header SHALL consist of three distinct zones:

- **Zone 1 (Global)**: Contains logo, connection status badge, playback status badge, Play/Stop button, and Share/Invite button. These controls are always visible and constant across all tabs.
- **Zone 2 (Tabs)**: Full-width tab bar with scrollable overflow when tab count exceeds available space. Each tab displays its label and an icon. Active tab is visually distinct (highlighted). Unread indicators (e.g., chat message count, composition activity dot) appear on their respective tabs.
- **Zone 3 (Context Toolbar)**: Tab-specific controls area. Contents change based on the active tab (e.g., "Load a starter" + "Clear" for Composition tab, "Shuffle" for ASCII Art tab). Height is dynamic—empty when a tab has no controls, or taller when controls are present.

#### Scenario: Zones stack vertically on mobile
- **WHEN** viewport width is below the md breakpoint (< 768px)
- **THEN** Zone 1, Zone 2, and Zone 3 stack in order (top to bottom), each taking full available width
- **AND** spacing and padding are consistent between stacked zones

#### Scenario: Zones layout horizontally on desktop
- **WHEN** viewport width is md or above (≥ 768px)
- **THEN** zones are arranged as rows: Zone 1 full-width at top, Zone 2 full-width below it, Zone 3 full-width below that

#### Scenario: Context toolbar is dynamic
- **WHEN** a tab has no specific controls to display
- **THEN** Zone 3 is either hidden or minimal (no wasted space)
- **AND WHEN** the user switches to a tab with controls
- **THEN** Zone 3 appears with the appropriate controls for that tab

#### Scenario: Tab bar scrolls when tabs exceed width
- **WHEN** the combined width of all tabs exceeds the available Zone 2 width
- **THEN** Zone 2 becomes horizontally scrollable
- **AND** visual affordance (e.g., fade-on-right or scroll indicator) signals that more tabs exist

### Requirement: Global controls always accessible
The Play/Stop button, connection status, and Share button in Zone 1 SHALL remain visible and functional regardless of which tab is active or how the content area is scrolling.

#### Scenario: Play button works while viewing any tab
- **WHEN** user clicks Play while the Chat tab is active
- **THEN** audio starts playback
- **AND** the playback status badge updates immediately in Zone 1

#### Scenario: Share button works while viewing any tab
- **WHEN** user clicks Share while the ASCII Art tab is active
- **THEN** the share dialog (or clipboard copy) is triggered
- **AND** the share action does not depend on the current tab

### Requirement: Active tab is visually distinct
The tab bar (Zone 2) SHALL clearly indicate which tab is currently active.

#### Scenario: Active tab styling
- **WHEN** a tab is active
- **THEN** it displays with distinct styling (e.g., highlighted background, different color)
- **AND** the styling is consistent with the project's visual language

#### Scenario: Switching tabs updates active indicator
- **WHEN** user clicks a different tab
- **THEN** the previous tab's active styling is removed
- **AND** the newly clicked tab is styled as active

### Requirement: Context toolbar actions are tab-specific
Controls in Zone 3 (Context Toolbar) SHALL be specific to the active tab and perform no action if the tab is not active.

#### Scenario: Composition controls only show in Composition tab
- **WHEN** user is on the Composition tab
- **THEN** Zone 3 displays "Load a starter" and "Clear" buttons
- **AND WHEN** user switches to Chat or ASCII Art tab
- **THEN** those buttons are no longer displayed (or Zone 3 is empty/minimal)

#### Scenario: ASCII Art shuffle only works in ASCII tab
- **WHEN** user is on the ASCII Art tab
- **THEN** Zone 3 displays "Shuffle" button
- **AND** clicking Shuffle fetches and displays a new ASCII Art piece
- **AND WHEN** user switches away from ASCII Art tab
- **THEN** the Shuffle button is no longer visible

### Requirement: "Switch to viewer" button is removed
The Composition Room header SHALL NOT display a "Switch to viewer" or role-switching button in Zone 1 or any global area.

#### Scenario: No role toggle in header
- **WHEN** a user views the Composition Room
- **THEN** there is no "Switch to viewer" button in Zone 1
- **AND** there is no other in-room control to change role — role is
  fixed for the session, chosen once at join

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
