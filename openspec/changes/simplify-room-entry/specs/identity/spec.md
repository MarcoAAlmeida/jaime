## MODIFIED Requirements

### Requirement: Display Name Required To Join A Room
The system SHALL require a display name to be set before a user joins a
room. The prompt SHALL suggest a name by default rather than starting
empty, so a user is never required to type before proceeding — they
may accept the suggestion as-is or replace it with their own.

#### Scenario: Joining without a name prompts for one
- **WHEN** a user attempts to create or join a room without having set a
  display name
- **THEN** they are prompted to set one before entering the room

#### Scenario: The prompt suggests a name by default
- **WHEN** a user without an account or a previously-set name reaches
  the display-name prompt
- **THEN** the prompt already shows a suggested name that they can
  accept immediately or edit before proceeding
