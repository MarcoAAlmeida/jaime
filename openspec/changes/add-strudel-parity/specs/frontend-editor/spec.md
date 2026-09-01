## MODIFIED Requirements

### Requirement: Sample Playback
The system SHALL make the full strudel.cc default sample map available
to playback — not a curated subset — so that a pattern referencing any
name from that map (drum hits like `bd`/`sd`/`hh`, break loops like
`amen`, and the broader instrument set) produces sound, not silence.

#### Scenario: A named-sample pattern plays
- **WHEN** a user triggers playback of a pattern that references one or
  more named samples from the default map
- **THEN** those samples are audible via the shared `AudioContext`

#### Scenario: Every curated library pattern plays
- **WHEN** any pattern from the curated Pattern library is placed in a
  track and playback is triggered
- **THEN** it evaluates without a pattern error and produces sound

#### Scenario: Sample loading does not block the editor
- **WHEN** the default sample map is being fetched for the first time
- **THEN** the editor stays interactive, and a pattern that uses only
  synth waveforms still plays without waiting on the sample fetch

#### Scenario: A pattern using a broader instrument sample plays
- **WHEN** a user plays a pattern that names a sample outside the old
  curated subset but present in the strudel.cc default map
- **THEN** it produces sound rather than a missing-sample silence

## ADDED Requirements

### Requirement: Labelled Multi-Pattern Documents
The system SHALL evaluate a document that defines more than one named
pattern with `$:` / `$<label>:` syntax, playing every labelled pattern
together, and SHALL let the user mute or solo an individual label
without re-evaluating.

#### Scenario: Two labelled patterns play together
- **WHEN** a document contains `$drums: …` and `$bass: …` and is
  evaluated
- **THEN** both patterns play simultaneously

#### Scenario: Muting one label leaves the others
- **WHEN** the user mutes one label of a running multi-pattern document
- **THEN** that label goes silent and the other labels keep playing,
  with no re-evaluation

### Requirement: Document-Controlled Tempo
The system SHALL honour a `setcps` / `setcpm` call in the evaluated
document as the pattern's cycle rate, except where a room's shared
transport clock owns tempo (see the composition-room and transport
capabilities), in which case the shared clock wins.

#### Scenario: setcps in a standalone document takes effect
- **WHEN** a document outside a tempo-synced room calls `setcps` and is
  evaluated
- **THEN** the pattern plays at that cycle rate

### Requirement: Mini-Notation Event Highlighting
The system SHALL highlight, in the editor, the mini-notation token(s)
of events as they are triggered during playback, so the user can see
which part of the code is currently sounding.

#### Scenario: The playing token lights up
- **WHEN** a pattern is playing
- **THEN** the editor visibly marks the token(s) being triggered on the
  current cycle, in time with the audio

#### Scenario: Highlighting stops with playback
- **WHEN** playback stops
- **THEN** the editor clears the event highlight

### Requirement: Pattern-Driven Visuals
The system SHALL render the visual outputs a Strudel pattern can
request — at least `punchcard`, `pianoroll`, `scope`, `spectrum`, and
`markcss` — driven by the running pattern, without requiring any
external visual-synthesis system.

#### Scenario: A pattern that requests a visualiser draws it
- **WHEN** a playing pattern calls one of the supported visual
  functions
- **THEN** the corresponding visual is drawn and animates with the
  audio

#### Scenario: A pattern with no visual call draws nothing
- **WHEN** a playing pattern requests no visualiser
- **THEN** no visual surface is shown and playback is unaffected
