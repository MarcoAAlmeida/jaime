## MODIFIED Requirements

### Requirement: Each `@jah` Reply Is Stateless

The system SHALL answer every `@jah`-addressed message independently,
with no memory of earlier messages in that room's chat — neither prior
human messages nor `@jah`'s own earlier replies are included when
generating a reply. Each reply SHALL be generated using the room's
current script and, when the asker has one, their own current text
selection — both read fresh for that mention, never carried over from
an earlier one.

#### Scenario: A follow-up gets no benefit from an earlier answer
- **WHEN** a participant sends a second `@jah`-addressed message after
  an earlier one in the same room
- **THEN** `@jah`'s reply is generated with no reference to that
  earlier exchange, as if it were the first message in the room

#### Scenario: A reply reflects the script as it is right now
- **WHEN** the room's script has changed since an earlier `@jah` mention
- **THEN** a new mention's reply is generated using the script's current
  content, not the content from any earlier mention

#### Scenario: A stale selection from an earlier message isn't reused
- **WHEN** a participant addresses `@jah` again without a selection
  this time, having included one on an earlier mention
- **THEN** this reply is generated with no selection, as if none had
  ever been provided

## ADDED Requirements

### Requirement: The Script Sent To `@jah` Is Bounded In Size

The system SHALL cap the size of the room's script included in a
reply's context. When the script exceeds that cap, the system SHALL
send the asker's selection, if they have one, together with the script
content nearest to it, in place of the full script, and SHALL tell
`@jah` that the full script was too large to include, rather than
silently sending a partial script with no notice.

#### Scenario: A script within the cap is sent whole
- **WHEN** the room's script is at or under the size cap
- **THEN** `@jah`'s reply is generated using the entire script

#### Scenario: An oversized script is truncated, not silently
- **WHEN** the room's script exceeds the size cap
- **THEN** `@jah` is given the selection (if any) and the script
  content nearest to it instead of the full script, and is told the
  full script was too large to include
