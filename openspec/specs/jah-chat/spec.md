# jah-chat Specification

## Purpose

`@jah` is the Composition Room's AI participant, reached through the
room's ordinary chat. This capability owns being addressed by mention,
deciding whether a reply is allowed at all (signed-in, access-granted,
under the spend caps, not killed), and recording what it cost —
independent of what a reply actually says.

## Requirements

### Requirement: `@jah` Is Addressed By A Leading Mention

The system SHALL treat a chat message as directed at `@jah` only when
its first token, case-insensitively, is `@jah`. Every other chat
message SHALL be delivered exactly as ordinary human chat is today,
with no `@jah` involvement.

#### Scenario: A message addressed to @jah

- **WHEN** a participant sends a chat message starting with `@jah`
  (in any letter casing)
- **THEN** the message is recognized as directed at `@jah`

#### Scenario: A message not addressed to @jah

- **WHEN** a participant sends a chat message that does not start with
  `@jah`
- **THEN** it is delivered as ordinary chat and `@jah` never replies

#### Scenario: A mid-message mention does not address @jah

- **WHEN** a participant sends a chat message containing `@jah`
  somewhere other than as the first token
- **THEN** it is delivered as ordinary chat and `@jah` never replies

### Requirement: Every `@jah`-Addressed Message Is A Discussion Request

The system SHALL treat any `@jah`-addressed message as a discussion
request and answer it as open discussion.

#### Scenario: A plain question is discussion

- **WHEN** a signed-in, access-granted participant sends `@jah` followed
  by a question
- **THEN** `@jah` treats it as a discussion request

### Requirement: Each `@jah` Reply Is Stateless

The system SHALL answer every `@jah`-addressed message independently,
with no memory of earlier messages in that room's chat — neither prior
human messages nor `@jah`'s own earlier replies are included when
generating a reply.

#### Scenario: A follow-up gets no benefit from an earlier answer
- **WHEN** a participant sends a second `@jah`-addressed message after
  an earlier one in the same room
- **THEN** `@jah`'s reply is generated with no reference to that
  earlier exchange, as if it were the first message in the room

### Requirement: `@jah` Requires A Signed-In, Access-Granted Account

The system SHALL reply to an `@jah`-addressed message only when the
sender is signed in and has effective `@jah` access. An anonymous
sender SHALL get no reply at all. A signed-in sender without access
SHALL get an explicit "invite-only" reply, not silence and not a
discussion answer.

#### Scenario: An anonymous message triggers nothing

- **WHEN** an anonymous participant sends a message addressed to `@jah`
- **THEN** no reply is sent, from `@jah` or otherwise

#### Scenario: A signed-in, non-allowlisted user is told it's invite-only

- **WHEN** a signed-in participant without effective `@jah` access sends
  a message addressed to `@jah`
- **THEN** `@jah` replies that access is invite-only, and does not
  answer the request itself

#### Scenario: A signed-in, allowlisted user gets a real reply

- **WHEN** a signed-in participant with effective `@jah` access sends a
  message addressed to `@jah`
- **THEN** `@jah` replies to the request

### Requirement: Daily Request Caps Bound Spend

The system SHALL enforce a per-user daily cap and a global daily cap on
`@jah` replies. A request that would exceed either cap SHALL get a
reply explaining the cap was hit rather than a discussion answer, and
SHALL NOT count against the cap itself.

#### Scenario: A user under their cap gets a normal reply

- **WHEN** an access-granted user addresses `@jah` and is under both
  their personal and the global daily cap
- **THEN** `@jah` replies normally

#### Scenario: A user over their personal cap is told so

- **WHEN** an access-granted user has already reached their per-user
  daily cap and addresses `@jah` again
- **THEN** `@jah` replies that their daily limit is reached, and does
  not answer the request itself

#### Scenario: The global cap protects everyone

- **WHEN** the global daily cap has been reached, regardless of who
  reaches it
- **THEN** any further `@jah`-addressed message gets a reply that the
  daily limit is reached, until the cap resets

### Requirement: A Kill Switch Can Disable `@jah` Entirely

The system SHALL provide an operator-controlled switch that, when off,
makes `@jah` never reply to anyone, regardless of access or caps. The
switch SHALL default to off, so a fresh deployment never spends until
the operator turns it on.

#### Scenario: @jah is silent while disabled

- **WHEN** the kill switch is off and any participant addresses `@jah`
- **THEN** no reply is sent, even for an access-granted user under both
  caps

#### Scenario: @jah resumes once enabled

- **WHEN** the operator turns the kill switch on
- **THEN** subsequent `@jah`-addressed messages are handled normally,
  subject to the other requirements

### Requirement: One `@jah` Request Is In Flight Per Room At A Time

The system SHALL process at most one `@jah` reply at a time within a
given room. A second `@jah`-addressed message arriving while one is
still being answered in the same room SHALL be queued or declined
rather than answered concurrently.

#### Scenario: A second request while one is in flight

- **WHEN** a participant addresses `@jah` while that room already has a
  reply in progress
- **THEN** the second request does not produce a second, concurrent
  reply — it waits or is declined, never interleaved with the first

#### Scenario: Different rooms do not block each other

- **WHEN** `@jah` is replying in one room
- **THEN** an `@jah`-addressed message in a different room is handled
  independently, not blocked by the first room's in-flight reply

### Requirement: Every `@jah` Reply Is Recorded

The system SHALL record one usage entry for every `@jah` reply that
actually calls the model — who asked, which room, the model used, and
an estimate of tokens/cost. A reply that never calls the model (kill
switch, no access, over a cap) SHALL NOT be recorded.

#### Scenario: A real reply is recorded

- **WHEN** `@jah` answers an access-granted, under-cap request
- **THEN** a usage record exists for that call, attributable to the
  requesting account and room

#### Scenario: A blocked request is not recorded

- **WHEN** `@jah` declines a request (no access, over a cap, or the
  kill switch is off)
- **THEN** no usage record is created for it

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

### Requirement: `@jah` Welcomes A Brand-New Room

The system SHALL post a single, static welcome message from `@jah` as
the first entry in a Composition Room's chat when that room's chat is
otherwise empty (a brand-new room, or one whose chat has reset after
emptying and a restart), introducing `@jah` and how to address it. This
welcome SHALL be visible to every participant regardless of sign-in
status or `@jah` access, SHALL NOT call the model, and SHALL NOT be
recorded as usage or count against any cap.

#### Scenario: A brand-new room starts with the welcome
- **WHEN** a person creates a new Composition Room
- **THEN** `@jah`'s welcome message already appears as the first entry
  in the room's chat, before anyone has sent a message

#### Scenario: An anonymous visitor still sees the welcome
- **WHEN** an anonymous, unauthenticated person is present when a
  room's chat is otherwise empty
- **THEN** they see `@jah`'s welcome message the same as anyone else,
  and no usage record or model call occurs for it

#### Scenario: A room with existing chat is not re-welcomed
- **WHEN** a participant joins a room whose chat already has messages
- **THEN** no additional welcome message is posted

### Requirement: A Typing Signal Shows While `@jah` Is Working

The system SHALL show participants that `@jah` is preparing a reply
from the moment a valid request starts being handled until the reply
(or decline) is delivered.

#### Scenario: Typing shows during a real reply

- **WHEN** `@jah` is generating a reply to an access-granted, under-cap
  request
- **THEN** participants see an indication that `@jah` is working, which
  clears once the reply is delivered

#### Scenario: No typing signal for a request that never reaches @jah

- **WHEN** a message is not addressed to `@jah`, or comes from an
  anonymous sender
- **THEN** no typing indication is shown

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
