## Purpose

`@jah` is the Composition Room's AI participant, reached through the
room's ordinary chat. This capability owns being addressed by mention,
deciding whether a reply is allowed at all (signed-in, access-granted,
under the spend caps, not killed), and recording what it cost —
independent of what a reply actually says.

## ADDED Requirements

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

### Requirement: Discussion Is The Default; `fix` And `edit` Are Reserved

The system SHALL treat any `@jah`-addressed message as a discussion
request unless the next token is `fix` or `edit` (case-insensitive), in
which case it SHALL reply that the request is not supported yet rather
than answering as open discussion.

#### Scenario: A plain question is discussion

- **WHEN** a signed-in, access-granted participant sends `@jah` followed
  by a question that is not `fix` or `edit`
- **THEN** `@jah` treats it as a discussion request

#### Scenario: fix is reserved, not discussion

- **WHEN** a participant sends `@jah fix` (with or without more text)
- **THEN** `@jah` replies that fixing isn't available yet, and does not
  answer as if it were a general question

#### Scenario: edit is reserved, not discussion

- **WHEN** a participant sends `@jah edit` (with or without more text)
- **THEN** `@jah` replies that editing isn't available yet, and does
  not answer as if it were a general question

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
way a human participant's message is attributed.

#### Scenario: A reply appears in the room's chat

- **WHEN** `@jah` replies
- **THEN** every participant currently in the room sees the reply in
  the chat, attributed to `@jah` with its avatar

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
