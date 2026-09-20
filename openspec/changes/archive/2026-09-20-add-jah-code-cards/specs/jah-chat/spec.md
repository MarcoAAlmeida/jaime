## ADDED Requirements

### Requirement: `@jah` Is Told A Playing Example Is Always Welcome

The system SHALL instruct `@jah`, on every request, that a playing
example is always welcome: whenever it suggests code, it should show a
short pattern that plays, in a fenced block labelled `strudel`, rather
than only inline fragments. The system SHALL also instruct `@jah` that
sound packs which are not loaded by default (for example the "amen"
break) need their pack loaded on the first line of the block, and that it
must never invent a sample pack. The system SHALL NOT depend on `@jah`
complying: a reply that has no example, or formats it imperfectly, is
delivered and displayed like any other reply.

#### Scenario: The instruction accompanies every request

- **WHEN** `@jah` handles a discussion request
- **THEN** the model is instructed that a playing example in a
  `strudel`-labelled fenced block is always welcome, and how to handle
  sound packs that are not loaded by default

#### Scenario: A reply without an example is harmless

- **WHEN** `@jah` replies with prose only, or with code in some other
  format
- **THEN** the reply is delivered to the room and shown as ordinary chat,
  and nothing else is affected

#### Scenario: The instruction does not change who can talk to @jah

- **WHEN** the instruction is in place
- **THEN** access, daily caps, the kill switch, statelessness and the
  one-request-per-room limit behave exactly as before
