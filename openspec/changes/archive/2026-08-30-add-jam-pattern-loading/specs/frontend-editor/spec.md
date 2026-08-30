## ADDED Requirements

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
