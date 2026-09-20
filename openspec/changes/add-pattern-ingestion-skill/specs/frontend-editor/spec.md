## MODIFIED Requirements

### Requirement: Sample Playback
The system SHALL make the full strudel.cc default sample map available
to playback — not a curated subset — so that a pattern referencing any
name from that map (drum hits like `bd`/`sd`/`hh`, break loops like
`breaks125`, and the broader instrument set) produces sound, not
silence. A sound that is not in the default map (for example the `amen`
break, which lives in a separate pack) is available only to a pattern
that loads its pack itself, so that the same code also plays on
strudel.cc.

#### Scenario: A named-sample pattern plays
- **WHEN** a user triggers playback of a pattern that references one or
  more named samples from the default map
- **THEN** those samples are audible via the shared `AudioContext`

#### Scenario: Every curated library pattern plays
- **WHEN** any pattern from the curated Pattern library is placed in a
  track and playback is triggered
- **THEN** it evaluates without a pattern error and produces sound

#### Scenario: A pattern using a pack outside the default map loads it
- **WHEN** a curated pattern uses a sound that is not in the default map
- **THEN** the pattern's own code loads the pack that provides it, and
  the pattern produces sound both here and on strudel.cc

#### Scenario: Sample loading does not block the editor
- **WHEN** the default sample map is being fetched for the first time
- **THEN** the editor stays interactive, and a pattern that uses only
  synth waveforms still plays without waiting on the sample fetch

#### Scenario: A pattern using a broader instrument sample plays
- **WHEN** a user plays a pattern that names a sample outside the old
  curated subset but present in the strudel.cc default map
- **THEN** it produces sound rather than a missing-sample silence
