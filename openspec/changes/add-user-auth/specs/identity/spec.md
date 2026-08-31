## MODIFIED Requirements

### Requirement: Display Name Does Not Persist Across Sessions
The system SHALL NOT assume a display name from a previous session for
a user without an account. A signed-in user's display name is supplied
from their account and persists across sessions and devices.

#### Scenario: A new session starts with no assumed name
- **WHEN** a user without an account starts a new session
- **THEN** the system does not assume any previously-used display name
  for them

#### Scenario: A signed-in user's name is already set
- **WHEN** a signed-in user starts a new session on any device
- **THEN** their display name is their account's display name, without
  being asked to set one again

#### Scenario: Signing in adopts the account name
- **WHEN** a user who set a session display name while anonymous then
  signs in
- **THEN** their account's display name is used from that point on
