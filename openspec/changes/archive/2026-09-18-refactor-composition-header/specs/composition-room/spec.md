## REMOVED Requirements

### Requirement: Choose Editor Or Viewer On Join
**Reason**: The header's "Switch to viewer" button was the only
in-room trigger for changing role after joining; this change removes
it (see the new "'Switch to viewer' button is removed" requirement
below) without relocating it, so the in-room switch it enabled is no
longer reachable and the requirement describing it no longer holds.
**Migration**: No data migration. A participant who wants a different
role leaves the room and rejoins, picking the other role at the join
gate — the join-time choice (`chooseRole`) is unchanged.

#### Scenario: Joining as a viewer
- **WHEN** a person joins a Composition Room and picks the viewer role
- **THEN** they see the live document and hear playback, and their
  role is shown to others as "viewer"

#### Scenario: Switching role in-room
- **WHEN** a participant switches between editor and viewer while in
  the room
- **THEN** their editing ability and the role others see for them
  update immediately, with no rejoin

## ADDED Requirements

### Requirement: Editor Or Viewer Is Chosen Once, At Join
The system SHALL let each joiner declare themselves an editor or a
viewer. The choice is self-declared — one link, no server-enforced
access control — and is fixed for the rest of that session: a
participant who wants a different role leaves and rejoins.

#### Scenario: Joining as a viewer
- **WHEN** a person joins a Composition Room and picks the viewer role
- **THEN** they see the live document and hear playback, and their
  role is shown to others as "viewer"

#### Scenario: Role is fixed for the session
- **WHEN** a participant has joined a Composition Room with a chosen
  role
- **THEN** that role does not change for the rest of that session —
  there is no in-room control to switch it

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
- **AND** role management (if needed in the future) lives elsewhere (e.g., tab-specific menu, settings)
