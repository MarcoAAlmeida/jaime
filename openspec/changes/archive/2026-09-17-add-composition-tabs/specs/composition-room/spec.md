## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Composition Room Has A Toggleable ASCII-Art Panel
**Reason**: Superseded by the tabbed interface — the independent
toggle, docked-beside-editor placement, and "either/both/neither open
at once" behavior this requirement described no longer hold once the
editor, chat, and ASCII art are mutually-exclusive tabs.
**Migration**: See "Composition Room Presents Three Tabs, One Visible
At A Time" below. The ASCII art content itself (what's shown, swap
timing, attribution) is unchanged — see the `ascii-overlay` capability
— only its container changes from a docked panel to a tab.

## ADDED Requirements

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
