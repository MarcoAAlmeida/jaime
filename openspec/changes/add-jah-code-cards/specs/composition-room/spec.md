## ADDED Requirements

### Requirement: `@jah`'s Strudel Code Appears As A Card

The system SHALL show each fenced block of Strudel code in an `@jah`
reply as a card in the chat: the code as plain text, with **Preview**,
**Copy code** and **Open in strudel.cc** actions. The text around the
code SHALL render as it does for any message. Only `@jah`'s replies get
cards; code fenced in a person's message stays an ordinary code block. A
block SHALL count as Strudel when it is labelled `strudel`, `js` or
`javascript`, or is unlabelled; a block labelled with any other language
stays an ordinary code block. When the model puts the label on the first
line inside the fence, that line SHALL NOT be shown as code. The card
shows no actions that load the code into JAM or into a Composition Room.

#### Scenario: A fenced pattern in an @jah reply becomes a card

- **WHEN** `@jah` replies with prose and a fenced `strudel` block
- **THEN** every participant sees the prose as text and the code as a
  card with Preview, Copy code and Open in strudel.cc

#### Scenario: Several blocks give several cards, in order

- **WHEN** an `@jah` reply contains two fenced Strudel blocks with text
  between them
- **THEN** the chat shows text, card, text, card in that order

#### Scenario: A person's fenced code is not a card

- **WHEN** a participant sends a message containing a fenced code block
- **THEN** it is shown as an ordinary code block with no card actions

#### Scenario: Formatting slips are tolerated

- **WHEN** an `@jah` reply fences code with no label, with `js`, or with
  the word `strudel` alone on the first line inside the fence
- **THEN** it still shows as a card, and the stray `strudel` line is not
  part of the displayed or copied code

#### Scenario: Other languages stay code blocks

- **WHEN** an `@jah` reply contains a fenced block labelled with another
  language such as `python`
- **THEN** it is shown as an ordinary code block, not a card

#### Scenario: Copy and open use exactly the card's code

- **WHEN** a participant chooses Copy code or Open in strudel.cc on a card
- **THEN** the copied code, or the code opened in strudel.cc in a new
  context, is exactly the card's displayed code

#### Scenario: Card code is only ever text

- **WHEN** an `@jah` reply's code contains HTML or script-like text
- **THEN** it is shown literally in the card and nothing in it is
  rendered or executed until a participant chooses Preview

#### Scenario: No load actions on a chat card

- **WHEN** a card is shown in the chat
- **THEN** it offers no "Load into JAM" or "Load into Composition Room"

### Requirement: Previewing A Card Pauses The Room For Everyone, Briefly

The system SHALL let an editor preview a card's code. Starting a preview
SHALL stop the room's playback for every participant, exactly as pressing
Stop does, so that no one is left out of sync with the room. The code
then plays for the previewer alone, for at most five seconds, after which
it goes silent. The room SHALL NOT restart by itself; it stays stopped
until someone presses Play. Preview SHALL NOT be offered to viewers.

#### Scenario: Previewing stops the room for everyone

- **WHEN** the room is playing and an editor chooses Preview on a card
- **THEN** playback stops for every participant, and the snippet plays
  for the previewer only

#### Scenario: A preview lasts at most five seconds

- **WHEN** a preview has been playing for five seconds
- **THEN** it stops on its own, the room stays stopped, and no
  participant's audio restarts

#### Scenario: A preview can be ended early

- **WHEN** a previewer chooses Stop while their preview is playing
- **THEN** the preview ends immediately

#### Scenario: Starting the room ends a preview

- **WHEN** someone presses Play in the room while a preview is playing
- **THEN** the preview ends and the room plays

#### Scenario: One preview at a time

- **WHEN** a previewer chooses Preview on a second card while the first
  is playing
- **THEN** the first stops and the second starts

#### Scenario: A pattern that fails says so

- **WHEN** a card's code fails to evaluate
- **THEN** the card shows the error, nothing plays, and the room's
  playback state is unaffected beyond having been stopped

#### Scenario: Viewers do not see Preview

- **WHEN** a participant with the viewer role sees a card
- **THEN** it shows Copy code and Open in strudel.cc but no Preview
