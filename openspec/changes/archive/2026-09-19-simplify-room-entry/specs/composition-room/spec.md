## REMOVED Requirements

### Requirement: Editor Or Viewer Is Chosen Once, At Join
**Reason**: The editor/viewer choice added a step with no current
value — there is no read-only audience today to justify asking. The
underlying role concept and viewer enforcement remain in the system
unchanged (see "A Viewer's Editor Is Strictly Read-Only"), just no
longer reachable through any UI path — kept dormant for a future case
that needs it, not deleted.
**Migration**: No data migration. Every participant, existing rooms
included, is simply an editor from the moment they join.

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

## ADDED Requirements

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
