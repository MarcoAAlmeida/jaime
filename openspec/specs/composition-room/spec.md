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
the sender is signed in with a profile picture, their avatar. A
participant's own messages SHALL be visually set apart from other
participants' messages in their own view. `@jah` (see the `jah-chat`
capability) is a possible sender, attributed the same way with its own
avatar.

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

#### Scenario: My own messages are set apart
- **WHEN** a participant sends a chat message
- **THEN** in their own view it is presented as their own message,
  distinguishable at a glance from other participants' messages, while
  every other participant sees it as another participant's message

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
control. If the room is currently playing, clearing SHALL stop
playback for every participant before the document is replaced,
rather than leaving the previous content's audio running.

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

#### Scenario: Clearing while playing stops playback for the room
- **WHEN** an editor clears the document while it is playing
- **THEN** playback stops for every participant and the document
  becomes empty, rather than the previous audio continuing under an
  empty document

### Requirement: A Chat Message Can Span Multiple Lines
The system SHALL let a participant compose a chat message over several
lines: pressing Enter sends the message, and pressing Shift+Enter
inserts a line break instead of sending. The input SHALL grow to fit
what has been typed. A message that is empty or only whitespace SHALL
NOT be sent.

#### Scenario: Enter sends
- **WHEN** a participant has typed a message and presses Enter
- **THEN** the message is sent and the input is cleared

#### Scenario: Shift+Enter adds a line
- **WHEN** a participant presses Shift+Enter while composing
- **THEN** a line break is inserted, the message is not sent, and the
  input grows to show the new line

#### Scenario: An empty message is not sent
- **WHEN** a participant presses Enter with nothing, or only
  whitespace, typed
- **THEN** nothing is sent

### Requirement: Chat Messages Render Markdown Safely
The system SHALL render every chat message — from a human or from
`@jah` — as Markdown, so inline code, code blocks, emphasis and lists
display as formatted text. Rendering SHALL be safe for messages from
anonymous participants: raw HTML in a message SHALL be shown as literal
text, never as markup; remote images SHALL NOT be loaded; and a link
SHALL be clickable only when it uses `http` or `https`, opening in a
new context without giving the target page access to the room.
Single line breaks within a message SHALL be preserved.

#### Scenario: Inline code and code blocks are formatted
- **WHEN** a message contains text in backticks or a fenced code block
- **THEN** it is displayed as inline code or a code block, and the text
  inside is shown exactly as typed

#### Scenario: Raw HTML is shown as text
- **WHEN** a participant sends a message containing HTML such as
  `<img src=x onerror=...>` or `<script>`
- **THEN** every participant sees that text literally, and nothing in
  it is executed or rendered as an element

#### Scenario: Remote images are not loaded
- **WHEN** a message contains Markdown image syntax pointing at a
  remote URL
- **THEN** no request is made to that URL and no image is displayed

#### Scenario: Only http and https links are followed
- **WHEN** a message contains a link
- **THEN** it is clickable only if it uses `http` or `https`, and it
  opens in a new context that cannot access the room page; a link with
  any other scheme (such as `javascript:`) is shown as plain text

#### Scenario: Line breaks are preserved
- **WHEN** a participant sends a multi-line message, including pasted
  code that isn't in a fence
- **THEN** each line appears on its own line rather than being joined
  into one paragraph

### Requirement: `@jah`'s Strudel Code Appears As A Card

The system SHALL show each fenced block of Strudel code in an `@jah`
reply as a card in the chat: the code as plain text, with **Preview**,
**Copy code** and **Open in strudel.cc** actions. The text around the
code SHALL render as it does for any message. Only `@jah`'s replies get
cards; code fenced in a person's message stays an ordinary code block. A
block SHALL count as Strudel when it is labelled `strudel`, `js` or
`javascript`, or is unlabelled; a block labelled with any other language
stays an ordinary code block. When the model puts the label on the first
line inside the fence, that line SHALL NOT be shown as code. The card
shows no actions that load the code into JAM or into a Composition Room.

#### Scenario: A fenced pattern in an @jah reply becomes a card

- **WHEN** `@jah` replies with prose and a fenced `strudel` block
- **THEN** every participant sees the prose as text and the code as a
  card with Preview, Copy code and Open in strudel.cc

#### Scenario: Several blocks give several cards, in order

- **WHEN** an `@jah` reply contains two fenced Strudel blocks with text
  between them
- **THEN** the chat shows text, card, text, card in that order

#### Scenario: A person's fenced code is not a card

- **WHEN** a participant sends a message containing a fenced code block
- **THEN** it is shown as an ordinary code block with no card actions

#### Scenario: Formatting slips are tolerated

- **WHEN** an `@jah` reply fences code with no label, with `js`, or with
  the word `strudel` alone on the first line inside the fence
- **THEN** it still shows as a card, and the stray `strudel` line is not
  part of the displayed or copied code

#### Scenario: Other languages stay code blocks

- **WHEN** an `@jah` reply contains a fenced block labelled with another
  language such as `python`
- **THEN** it is shown as an ordinary code block, not a card

#### Scenario: Copy and open use exactly the card's code

- **WHEN** a participant chooses Copy code or Open in strudel.cc on a card
- **THEN** the copied code, or the code opened in strudel.cc in a new
  context, is exactly the card's displayed code

#### Scenario: Card code is only ever text

- **WHEN** an `@jah` reply's code contains HTML or script-like text
- **THEN** it is shown literally in the card and nothing in it is
  rendered or executed until a participant chooses Preview

#### Scenario: No load actions on a chat card

- **WHEN** a card is shown in the chat
- **THEN** it offers no "Load into JAM" or "Load into Composition Room"

### Requirement: Previewing A Card Pauses The Room For Everyone, Briefly

The system SHALL let an editor preview a card's code. Starting a preview
SHALL stop the room's playback for every participant, exactly as pressing
Stop does, so that no one is left out of sync with the room. The code
then plays for the previewer alone, for at most five seconds, after which
it goes silent. The room SHALL NOT restart by itself; it stays stopped
until someone presses Play. Preview SHALL NOT be offered to viewers.

#### Scenario: Previewing stops the room for everyone

- **WHEN** the room is playing and an editor chooses Preview on a card
- **THEN** playback stops for every participant, and the snippet plays
  for the previewer only

#### Scenario: A preview lasts at most five seconds

- **WHEN** a preview has been playing for five seconds
- **THEN** it stops on its own, the room stays stopped, and no
  participant's audio restarts

#### Scenario: A preview can be ended early

- **WHEN** a previewer chooses Stop while their preview is playing
- **THEN** the preview ends immediately

#### Scenario: Starting the room ends a preview

- **WHEN** someone presses Play in the room while a preview is playing
- **THEN** the preview ends and the room plays

#### Scenario: One preview at a time

- **WHEN** a previewer chooses Preview on a second card while the first
  is playing
- **THEN** the first stops and the second starts

#### Scenario: A pattern that fails says so

- **WHEN** a card's code fails to evaluate
- **THEN** the card shows the error, nothing plays, and the room's
  playback state is unaffected beyond having been stopped

#### Scenario: Viewers do not see Preview

- **WHEN** a participant with the viewer role sees a card
- **THEN** it shows Copy code and Open in strudel.cc but no Preview

### Requirement: An Editor Can Load A Favorited Pattern As The Shared Document
The system SHALL let a participant with the editor role replace the
whole shared document with the code of any pattern from the
pattern-library whose `favorite` flag is true, chosen from a
searchable list, for every participant. A participant with the viewer
role SHALL NOT be able to trigger this control. If the room is
currently playing, loading a pattern SHALL stop playback for every
participant before the document is replaced, rather than leaving the
previous content's audio running under the newly loaded code.

#### Scenario: An editor loads a favorited pattern
- **WHEN** an editor picks a pattern from the favorited-pattern list
- **THEN** the shared document becomes that pattern's code for every
  participant

#### Scenario: The list is searchable
- **WHEN** an editor types into the pattern picker
- **THEN** the list narrows to favorited patterns matching what they
  typed

#### Scenario: Only favorited patterns are offered
- **WHEN** an editor opens the pattern picker
- **THEN** only patterns with `favorite = true` appear in the list

#### Scenario: A viewer cannot load a pattern
- **WHEN** a participant with the viewer role looks for the pattern
  picker
- **THEN** they cannot trigger it

#### Scenario: Loading while playing stops playback for the room
- **WHEN** an editor loads a favorited pattern while the document is
  playing
- **THEN** playback stops for every participant and the document
  becomes the loaded pattern's code, rather than the previous audio
  continuing under the newly loaded code

### Requirement: The Shared Document Can Be Opened In strudel.cc
The system SHALL let any participant open the room's current shared
document directly in the official strudel.cc REPL, without a server
round-trip, regardless of whether that document originated from a
favorited pattern or was typed from scratch.

#### Scenario: Opening the current document in strudel.cc
- **WHEN** a participant triggers "open in strudel.cc"
- **THEN** a new browser tab opens strudel.cc with the shared
  document's current content ready to play
