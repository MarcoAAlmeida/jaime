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
together. Muting a label is done the Strudel-native way — prefixing its
name with `_` — which re-evaluates the document; a no-re-evaluation
mixer UI is out of scope (a later change).

#### Scenario: Two labelled patterns play together
- **WHEN** a document contains `$drums: …` and `$bass: …` and is
  evaluated
- **THEN** both patterns play simultaneously

#### Scenario: A `_`-prefixed label is silent
- **WHEN** a label is renamed from `$drums:` to `$_drums:` and the
  document is re-evaluated
- **THEN** that pattern is silent and the other labels keep playing

### Requirement: Document-Controlled Tempo
The system SHALL honour a `setcps` / `setcpm` call in the evaluated
document as the pattern's cycle rate.

#### Scenario: setcps in a document takes effect
- **WHEN** a document calls `setcps` and is evaluated
- **THEN** the pattern plays at that cycle rate

> A JAM room's shared transport start-aligns every track to a common
> cycle boundary but does not currently override a per-track `setcps`;
> strict shared-clock tempo ownership is specified by the
> `composition-room` capability, where it matters, and revisited for
> JAM there.

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

> Pattern-driven visuals (`punchcard` / `pianoroll` / `scope` /
> `spectrum`) are **not** in this change. The engine loads
> `@strudel/draw` and a visual call in a pattern no longer errors, but
> nothing is rendered yet — a later change adds a proper editor-backdrop
> canvas (the way strudel.cc does it).
