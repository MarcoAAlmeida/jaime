## Purpose

The JAM room and Composition Room screens adapt to the viewport —
controls stay reachable and unobstructed, code stays readable without
horizontal scrolling, and sharing a room is a single action — so the
rooms work on a phone held vertically, not only on a wide desktop.

## ADDED Requirements

### Requirement: Room Controls Are Reachable And Unobstructed At Any Width
In both room screens (JAM room, Composition Room) the header and its
controls SHALL remain fully visible, non-overlapping, and operable at
any viewport width down to a narrow phone. No control SHALL be drawn on
top of another element, and every control SHALL stay reachable — moving
into a wrap row or an overflow menu is acceptable, disappearing or
being covered is not.

#### Scenario: Narrow portrait viewport
- **WHEN** a user opens a room on a phone-width portrait viewport
- **THEN** the logo and every header control are visible and not
  overlapping, and each control can be activated

#### Scenario: Short landscape viewport
- **WHEN** a user opens a room on a short landscape (phone rotated)
  viewport
- **THEN** the header does not consume the screen, the editor is still
  usable, and no control is clipped or covered

#### Scenario: Bottom of the screen is not clipped by browser chrome
- **WHEN** a room is open in a mobile browser whose toolbar overlays the
  viewport
- **THEN** the room's own bottom controls (e.g. the chat input) are not
  hidden behind the browser chrome

### Requirement: Code Is Read Without Horizontal Scrolling On Narrow Viewports
On a viewport too narrow to show a line of code in full, the editor
SHALL wrap the line so the whole line is visible by scrolling only
vertically. The user SHALL NOT have to scroll the editor horizontally to
read the end of a line. This applies to every editor instance — each
JAM track and the Composition Room's shared document.

#### Scenario: A long line on a phone
- **WHEN** the editor holds a line wider than a phone-width viewport
- **THEN** the line is shown wrapped, and the editor's content does not
  extend wider than the viewport

#### Scenario: Wide viewport is unaffected
- **WHEN** the editor is shown on a viewport wide enough for the code
- **THEN** lines are not force-wrapped and the editor behaves as before

### Requirement: Sharing A Room Is A Single Action
From inside a room, a participant SHALL be able to share the room's
invite link in one action. Where the device provides a native share
mechanism, the action SHALL invoke it so the link can be sent to a
contact without a manual copy-and-paste; otherwise the action SHALL copy
the link to the clipboard and confirm that it did.

#### Scenario: Device has a native share sheet
- **WHEN** a participant triggers the share action on a device that
  supports native sharing
- **THEN** the device's share sheet opens with the room's invite link
  ready to send

#### Scenario: Device has no native share sheet
- **WHEN** a participant triggers the share action on a device without
  native sharing
- **THEN** the invite link is copied to the clipboard and the UI
  confirms the copy

#### Scenario: The shared link opens the same room
- **WHEN** another person opens the shared link
- **THEN** they are taken to the same room
