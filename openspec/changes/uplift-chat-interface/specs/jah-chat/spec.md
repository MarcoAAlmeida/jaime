## MODIFIED Requirements

### Requirement: `@jah`'s Messages Are Attributed Like Any Participant's

The system SHALL deliver every `@jah` reply through the room's existing
chat, attributed to `@jah` and shown with `@jah`'s own avatar, the same
way a human participant's message is attributed. `@jah`'s messages
SHALL also be presented as the assistant's — visually distinct from any
human participant's message — so a reader can tell a reply from a
person's message without reading the name. `@jah`'s avatar SHALL be a
red, rounded lion, credited to its artist wherever it is shown.

#### Scenario: `@jah`'s avatar is a red lion

- **WHEN** `@jah`'s avatar is shown — on a reply, on the welcome
  message, or on the "thinking" bubble
- **THEN** it is a red lion in a round badge, the same everywhere it
  appears

#### Scenario: The avatar credits its artist

- **WHEN** a participant inspects `@jah`'s avatar
- **THEN** it names the lion's artist and licence, and the icon and
  its author are listed in the game-icons attribution record

#### Scenario: A reply appears in the room's chat

- **WHEN** `@jah` replies
- **THEN** every participant currently in the room sees the reply in
  the chat, attributed to `@jah` with its avatar

#### Scenario: A reply looks different from a human's message

- **WHEN** `@jah`'s reply appears alongside messages from people
- **THEN** it is styled distinctly from the human messages, in every
  participant's view

## ADDED Requirements

### Requirement: The Server Tells Each Participant Whether `@jah` Is Available To Them

The system SHALL, when a participant joins a Composition Room, tell
that participant whether `@jah` is available to them, as one of:
available; unavailable because they are signed out; unavailable
because their account has no `@jah` access; or unavailable because
`@jah` is switched off. The answer is determined once, at join — a
change in access or in the kill switch is picked up on the
participant's next join, consistent with how `@jah` access is already
resolved. This signal SHALL NOT change whether or how `@jah` replies;
those rules are unchanged.

#### Scenario: A signed-out visitor is told they're signed out

- **WHEN** an anonymous participant joins a room
- **THEN** they are told `@jah` is unavailable because they are signed
  out

#### Scenario: A signed-in account without access is told so

- **WHEN** a signed-in participant without effective `@jah` access
  joins a room
- **THEN** they are told `@jah` is unavailable because their account
  has no access

#### Scenario: A switched-off @jah is reported as such

- **WHEN** the kill switch is off and a participant joins a room
- **THEN** they are told `@jah` is unavailable because it is switched
  off, regardless of their own access

#### Scenario: An eligible participant is told it's available

- **WHEN** a signed-in participant with effective `@jah` access joins a
  room while `@jah` is switched on
- **THEN** they are told `@jah` is available

### Requirement: The Chat Input Offers A Direct-To-`@jah` Mode

The system SHALL offer, alongside the chat input, a switch that sends
the participant's messages to `@jah` without their typing the mention.
While the switch is on, each message the participant sends SHALL have
`@jah` prepended (unless it already starts with `@jah`), and the
switch SHALL stay on for later messages until they turn it off. The
switch SHALL start off. A message sent this way is an ordinary public
chat message, visible to everyone in the room exactly as if the
participant had typed the mention themselves; nothing about who can
see the exchange changes.

#### Scenario: The switch starts off

- **WHEN** a participant opens a room
- **THEN** the direct-to-`@jah` switch is off, and their messages are
  sent exactly as typed

#### Scenario: With the switch on, messages go to @jah

- **WHEN** an eligible participant turns the switch on and sends
  "what does .fast do?"
- **THEN** the room sees the message as "@jah what does .fast do?" and
  `@jah` handles it as a normal `@jah`-addressed message

#### Scenario: The switch stays on until turned off

- **WHEN** a participant with the switch on sends several messages in a
  row
- **THEN** each one is sent to `@jah`, until they turn the switch off

#### Scenario: An existing mention is not doubled

- **WHEN** the switch is on and the participant types a message that
  already begins with `@jah`
- **THEN** the message is sent with a single leading `@jah`

#### Scenario: The exchange stays public

- **WHEN** a participant uses the switch
- **THEN** every other participant in the room still sees both the
  message and `@jah`'s reply

### Requirement: The Direct-To-`@jah` Mode Is Unavailable When `@jah` Cannot Reply

The system SHALL disable the direct-to-`@jah` switch, and say why,
whenever `@jah` is not available to the participant: signed out, no
access, or switched off. A disabled switch SHALL NOT change what
happens when the participant types a `@jah` mention by hand — that
message is still handled by the existing rules (for example silence
for an anonymous sender, or the invite-only reply for a signed-in
sender without access).

#### Scenario: A signed-out visitor sees a disabled switch

- **WHEN** an anonymous participant is in a room
- **THEN** the switch is disabled and indicates they need to sign in to
  talk to `@jah`

#### Scenario: An account without access sees a disabled switch

- **WHEN** a signed-in participant without `@jah` access is in a room
- **THEN** the switch is disabled and indicates `@jah` is invite-only

#### Scenario: A switched-off @jah shows a disabled switch

- **WHEN** the kill switch is off
- **THEN** every participant's switch is disabled and indicates `@jah`
  is offline

#### Scenario: Typing the mention by hand still follows the normal rules

- **WHEN** a participant whose switch is disabled types a message
  starting with `@jah`
- **THEN** it is sent as typed and handled by the existing `@jah`
  rules, exactly as before

### Requirement: The Chat Input Shows A Model Selector Placeholder

The system SHALL show a model selector alongside the chat input so it
is clear the model will eventually be choosable. Until model selection
is supported, using the selector SHALL show a notice that it is not
implemented yet and SHALL NOT change which model `@jah` uses or
otherwise affect any message.

#### Scenario: Using the selector says it isn't implemented

- **WHEN** a participant opens or tries to use the model selector
- **THEN** they see a notice that model selection is not implemented
  yet

#### Scenario: The selector changes nothing

- **WHEN** a participant has interacted with the model selector and
  then addresses `@jah`
- **THEN** `@jah` replies exactly as it would have without that
  interaction
