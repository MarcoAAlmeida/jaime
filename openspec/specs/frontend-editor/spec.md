## Purpose

Provides the single-user Strudel pattern editor and local audio playback
that jaime's collaborative jam room will later be built on top of.

## Requirements

### Requirement: Pattern Editing
The system SHALL provide one CodeMirror 6 editor per track in the fixed
roster, editable only by the client that currently owns that track.

#### Scenario: Editor mounts on page load
- **WHEN** a user opens the jam route and the page finishes loading
- **THEN** a CodeMirror editor instance is visible and focusable for
  each track in the roster

#### Scenario: Non-owner cannot edit a track
- **WHEN** a user views a track they do not own
- **THEN** that track's editor does not accept edits from them

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
independent of any realtime backend, and reachable at the
`jaime.stream` custom domain.

#### Scenario: Deployed build serves the editor
- **WHEN** a user visits `https://jaime.stream`
- **THEN** the editor and playback work identically to local
  `wrangler dev`

### Requirement: Sample Playback
The system SHALL make a default set of named audio samples available to
playback, so a pattern that references samples by name (e.g. `bd`,
`sd`, `hh`, `amen`) produces sound, not silence.

#### Scenario: A named-sample pattern plays
- **WHEN** a user triggers playback of a pattern that references one or
  more named samples from the default set
- **THEN** those samples are audible via the shared `AudioContext`

#### Scenario: Every curated library pattern plays
- **WHEN** any pattern from the curated Pattern library is placed in a
  track and playback is triggered
- **THEN** it evaluates without a pattern error and produces sound

#### Scenario: Sample loading does not block the editor
- **WHEN** the default sample set is being fetched for the first time
- **THEN** the editor stays interactive, and a pattern that uses only
  synth waveforms still plays without waiting on the sample fetch
