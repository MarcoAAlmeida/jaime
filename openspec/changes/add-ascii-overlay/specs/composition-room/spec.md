## ADDED Requirements

### Requirement: Composition Room Has A Toggleable ASCII-Art Panel
The system SHALL let a participant toggle a decorative ASCII-art panel
on and off for the Composition Room, off by default. When on, the
panel docks beside the editor — the editor pane shares width with it
rather than being covered — with its own solid, editor-matching
background at every screen size. The panel's toggle is independent of
the existing participants/chat panel's toggle: either, both, or neither
may be open at once. The panel SHALL NOT obscure the room's header or
its controls, regardless of its state.

#### Scenario: Turning the panel on
- **WHEN** a participant toggles the ASCII panel on
- **THEN** the panel appears docked beside the editor, showing an
  ASCII-art piece (see the `ascii-overlay` capability for what is shown
  and when it changes), and the editor remains visible and usable in
  the remaining space

#### Scenario: Turning the panel off
- **WHEN** a participant toggles the ASCII panel off
- **THEN** the panel disappears and the editor returns to using the
  full pane

#### Scenario: The ASCII panel and chat panel are independent
- **WHEN** a participant opens the ASCII panel while the chat panel is
  already open (or vice versa)
- **THEN** both panels are shown docked beside the editor, and closing
  one leaves the other open

#### Scenario: The panel never covers room controls
- **WHEN** the ASCII panel is on, at any viewport size
- **THEN** the room's header and its controls (including the panel's
  own toggle) remain visible and usable
