## ADDED Requirements

### Requirement: A Chat Message May Carry The Sender's Own Selection

The system SHALL allow a chat message to include the sender's own
current text selection from the shared document. The server SHALL
bound its size, and SHALL make use of a selection only on a message
addressed to `@jah` from a sender who can reach `@jah` — every other
message's selection, if present, SHALL be ignored entirely, including
for delivery to other participants: no participant's selection is ever
shown to anyone else through chat.

#### Scenario: A selection accompanies a @jah mention
- **WHEN** a signed-in, access-granted participant addresses `@jah`
  with a message that includes their current selection
- **THEN** `@jah`'s reply is generated using that selection

#### Scenario: A selection is ignored on an ordinary message
- **WHEN** a participant sends a chat message with a selection attached
  that isn't addressed to `@jah`
- **THEN** the selection has no effect and the message is delivered
  exactly as it would be with none

#### Scenario: A selection is ignored from someone who can't reach @jah
- **WHEN** an anonymous participant, or a signed-in participant without
  `@jah` access, sends a message with a selection attached
- **THEN** the selection has no effect — the existing decline rules for
  that sender still apply unchanged

#### Scenario: An oversized selection is bounded, not rejected
- **WHEN** a selection larger than the size limit is sent
- **THEN** the server trims it before use rather than rejecting the
  message or using it unbounded

#### Scenario: A selection is never shown to other participants
- **WHEN** a message carries a selection
- **THEN** no other participant's view reveals what that selection was
