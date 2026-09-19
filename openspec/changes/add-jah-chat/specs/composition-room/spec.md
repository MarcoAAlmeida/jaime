## MODIFIED Requirements

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

### Requirement: Ephemeral Room Chat
The system SHALL provide a text chat beside the editor for the people
in the room. Messages are delivered to everyone currently connected and
are not persisted — chat history is empty after a restart or once the
room empties. Each message SHALL be attributed to the sender's display
name and, where the sender is signed in with a profile picture, their
avatar. `@jah` (see the `jah-chat` capability) is a possible sender,
attributed the same way with its own avatar.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name, with the sender's avatar
  when they have one

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat panel is empty

#### Scenario: An @jah reply is chat like any other
- **WHEN** `@jah` replies in a room
- **THEN** its reply is delivered to everyone currently connected the
  same way a human's message is, and does not survive the room emptying
  or a restart any differently

## ADDED Requirements

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
