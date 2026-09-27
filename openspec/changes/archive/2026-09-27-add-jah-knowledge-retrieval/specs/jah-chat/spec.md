## MODIFIED Requirements

### Requirement: Every `@jah` Reply Is Recorded

The system SHALL record one usage entry for every `@jah` reply that
actually calls the model — who asked, which room, the model used, an
estimate of tokens/cost, and how many pieces of retrieved knowledge were
used to ground the reply. A reply that never calls the model (kill
switch, no access, over a cap) SHALL NOT be recorded.

#### Scenario: A real reply is recorded

- **WHEN** `@jah` answers an access-granted, under-cap request
- **THEN** a usage record exists for that call, attributable to the
  requesting account and room, and it records how many pieces of
  retrieved knowledge grounded the reply (zero if none)

#### Scenario: A blocked request is not recorded

- **WHEN** `@jah` declines a request (no access, over a cap, or the
  kill switch is off)
- **THEN** no usage record is created for it

## ADDED Requirements

### Requirement: A Grounded Reply Shows Its Sources

When a reply used any retrieved knowledge, the system SHALL show the
sources that knowledge came from alongside the reply, visible to every
participant who sees the reply. A reply grounded in no retrieved
knowledge SHALL show no sources.

#### Scenario: A grounded reply names its sources
- **WHEN** `@jah`'s reply used retrieved knowledge
- **THEN** the sources that knowledge came from are visible alongside
  the reply, to everyone in the room

#### Scenario: An ungrounded reply shows nothing extra
- **WHEN** `@jah`'s reply used no retrieved knowledge
- **THEN** no sources are shown alongside it
