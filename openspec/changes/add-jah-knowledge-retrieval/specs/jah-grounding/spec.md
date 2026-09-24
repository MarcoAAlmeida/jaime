## Purpose

Governs how `@jah` gathers relevant knowledge before answering a
mention, and how that knowledge reaches the model: reply assembly
accepts optional context to include in the model's input and returns
the sources that context came from, and a mention is resolved against
the Strudel knowledge store — by exact name where one is referenced, and
by meaning always — to build that context. With no relevant knowledge
found, a reply is generated exactly as it would be with none of this in
place.

## ADDED Requirements

### Requirement: Reply Assembly Accepts Optional Context And Returns Sources

The system SHALL allow a set of context items to be supplied when
generating a reply, each placed in the model's input as reference
material, and SHALL return the list of sources that context came from
alongside the generated text. With no context items supplied, the
model's input SHALL be exactly what it would be with this capability
absent entirely.

#### Scenario: Context is included in the model's input
- **WHEN** one or more context items are supplied for a reply
- **THEN** each is present in the input the model receives, and the
  reply's sources list names each one

#### Scenario: No context changes nothing
- **WHEN** a reply is generated with no context items supplied
- **THEN** the model's input is identical to what it would be if this
  capability did not exist, and no sources are returned

### Requirement: A Mention Is Resolved To Relevant Knowledge

Before generating a reply, the system SHALL attempt to resolve any
Strudel function explicitly referenced in the mention's text (for
example, a name written in backticks or preceded by a dot) against the
knowledge store by exact name, and SHALL always additionally search the
store by the meaning of the mention's own text. The results SHALL be
combined into one list of context items with no repeated source, bounded
to a small maximum so the reply's prompt size stays bounded regardless
of how large the knowledge store grows.

#### Scenario: An explicitly named function is resolved exactly
- **WHEN** a mention explicitly names a real function in the store
- **THEN** that function's own knowledge is among the context items used
  for the reply

#### Scenario: A vague mention still retrieves relevant knowledge
- **WHEN** a mention names no specific function but describes an intent
- **THEN** context items relevant to that intent are used for the reply

#### Scenario: The same source is never included twice
- **WHEN** exact resolution and meaning-based search both surface the
  same piece of knowledge
- **THEN** it appears once in the context used for the reply

#### Scenario: The number of context items is bounded
- **WHEN** resolving a mention would otherwise surface more relevant
  knowledge than the bound allows
- **THEN** only the bounded number of context items is used, not all of
  them

#### Scenario: A mention with no relevant knowledge in the store gets none
- **WHEN** the knowledge store has nothing relevant to a mention
- **THEN** the reply is generated with no context items, the same as if
  this capability were absent
