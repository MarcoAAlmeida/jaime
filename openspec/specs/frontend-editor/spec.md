## Purpose

Provides the single-user Strudel pattern editor and local audio playback
that jaime's collaborative jam room will later be built on top of.

## Requirements

### Requirement: Pattern Editing
The system SHALL provide a CodeMirror 6 editor for entering Strudel
pattern code.

#### Scenario: Editor mounts on page load
- **WHEN** a user opens the jam route and the page finishes loading
- **THEN** a CodeMirror editor instance is visible and focusable

### Requirement: Local Playback
The system SHALL play the entered Strudel pattern locally via Web Audio
when the user starts playback.

#### Scenario: Valid pattern plays
- **WHEN** the user triggers playback with a syntactically valid Strudel
  pattern in the editor
- **THEN** audio is audible via the shared `AudioContext`

#### Scenario: Invalid pattern does not crash playback
- **WHEN** the user triggers playback with a syntactically invalid pattern
  in the editor
- **THEN** an error is surfaced in the UI and the `AudioContext` remains
  usable for subsequent valid patterns

### Requirement: Static Deployment
The system SHALL be deployable as static assets on Cloudflare Workers,
independent of any realtime backend.

#### Scenario: Deployed build serves the editor
- **WHEN** a user visits the `*.workers.dev` URL produced by
  `wrangler deploy`
- **THEN** the editor and playback work identically to local
  `wrangler dev`
