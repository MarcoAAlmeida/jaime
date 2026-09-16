## Purpose

Supplies the ASCII-art content and swap timing that the Composition
Room's panel (see the `composition-room` capability) displays,
sourced from a locally scraped copy of asciiart.eu with attribution to
the original artist kept intact.

## ADDED Requirements

### Requirement: Displayed Art Comes From Locally Scraped Data
The system SHALL serve every displayed piece from data scraped ahead of
time into local storage. The system SHALL NOT fetch asciiart.eu, or any
other external ascii-art source, at request time.

#### Scenario: A piece is shown without any live external request
- **WHEN** the panel displays a piece
- **THEN** the piece and its metadata come entirely from local data,
  with no outbound request to asciiart.eu made to produce it

### Requirement: Every Displayed Piece Is Attributed
The system SHALL show the artist name (or an explicit "unknown"
indicator when none is recorded) and a link back to the piece's
original asciiart.eu page alongside every displayed piece.

#### Scenario: A piece with a known artist
- **WHEN** the panel displays a piece whose artist is recorded
- **THEN** the artist's name is shown with a link to the piece's
  original asciiart.eu page

#### Scenario: A piece with no recorded artist
- **WHEN** the panel displays a piece with no artist on record
- **THEN** an explicit "unknown artist" indicator is shown, still
  linked back to the piece's original asciiart.eu page

### Requirement: Selection Is Unfiltered And Random
The system SHALL select each displayed piece at random from the entire
scraped dataset, with no curation, ranking, or category filtering
applied.

#### Scenario: Independent sessions see independently random pieces
- **WHEN** the ASCII panel is used in two separate room sessions
- **THEN** the sequence of pieces shown in each session is independently
  randomized, not a fixed or shared order

### Requirement: The Displayed Piece Advances On A Fixed Beat Interval During Playback
The system SHALL advance the panel to a newly, randomly selected
piece every Nth scheduler event while the room's shared document is
playing, where N is a fixed, operator-set parameter. The system SHALL
NOT advance the displayed piece while playback is stopped.

#### Scenario: The piece advances during playback
- **WHEN** the room is playing and N scheduler events have elapsed
  since the last advance
- **THEN** the panel advances to a new, randomly selected piece

#### Scenario: The piece does not advance while stopped
- **WHEN** the room's shared document is not playing
- **THEN** the panel's displayed piece does not change

### Requirement: The Displayed Piece Is Rendered To Fit The Panel
The system SHALL render each piece scaled to fit the available panel
area based on that piece's own character dimensions, regardless of how
small or large the piece is.

#### Scenario: A small piece is not oversized
- **WHEN** the panel displays a piece much smaller than the panel
  area
- **THEN** the piece is rendered legibly within the area, not stretched
  to dominate it disproportionately

#### Scenario: A large piece is not clipped
- **WHEN** the panel displays a piece large enough to overflow the
  panel area at a fixed size
- **THEN** the piece is scaled down to remain fully visible within the
  area, with no part cut off
