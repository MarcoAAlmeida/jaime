## MODIFIED Requirements

### Requirement: Ephemeral Room Chat
The system SHALL provide a text chat, within the room's Chat tab
alongside the participant roster, for the people in the room. Messages
are delivered to everyone currently connected and are not persisted —
chat history is empty after a restart or once the room empties. Each
message SHALL be attributed to the sender's display name and, where
the sender is signed in with a profile picture, their avatar. A
participant's own messages SHALL be visually set apart from other
participants' messages in their own view. `@jah` (see the `jah-chat`
capability) is a possible sender, attributed the same way with its own
avatar.

#### Scenario: A message reaches everyone present
- **WHEN** a participant sends a chat message
- **THEN** every other currently-connected participant sees it,
  attributed to the sender's display name, with the sender's avatar
  when they have one

#### Scenario: Chat history does not come back
- **WHEN** the room empties or the Worker restarts and someone rejoins
- **THEN** the chat log is empty

#### Scenario: An @jah reply is chat like any other
- **WHEN** `@jah` replies in a room
- **THEN** its reply is delivered to everyone currently connected the
  same way a human's message is, and does not survive the room emptying
  or a restart any differently

#### Scenario: My own messages are set apart
- **WHEN** a participant sends a chat message
- **THEN** in their own view it is presented as their own message,
  distinguishable at a glance from other participants' messages, while
  every other participant sees it as another participant's message

## ADDED Requirements

### Requirement: A Chat Message Can Span Multiple Lines
The system SHALL let a participant compose a chat message over several
lines: pressing Enter sends the message, and pressing Shift+Enter
inserts a line break instead of sending. The input SHALL grow to fit
what has been typed. A message that is empty or only whitespace SHALL
NOT be sent.

#### Scenario: Enter sends
- **WHEN** a participant has typed a message and presses Enter
- **THEN** the message is sent and the input is cleared

#### Scenario: Shift+Enter adds a line
- **WHEN** a participant presses Shift+Enter while composing
- **THEN** a line break is inserted, the message is not sent, and the
  input grows to show the new line

#### Scenario: An empty message is not sent
- **WHEN** a participant presses Enter with nothing, or only
  whitespace, typed
- **THEN** nothing is sent

### Requirement: Chat Messages Render Markdown Safely
The system SHALL render every chat message — from a human or from
`@jah` — as Markdown, so inline code, code blocks, emphasis and lists
display as formatted text. Rendering SHALL be safe for messages from
anonymous participants: raw HTML in a message SHALL be shown as literal
text, never as markup; remote images SHALL NOT be loaded; and a link
SHALL be clickable only when it uses `http` or `https`, opening in a
new context without giving the target page access to the room.
Single line breaks within a message SHALL be preserved.

#### Scenario: Inline code and code blocks are formatted
- **WHEN** a message contains text in backticks or a fenced code block
- **THEN** it is displayed as inline code or a code block, and the text
  inside is shown exactly as typed

#### Scenario: Raw HTML is shown as text
- **WHEN** a participant sends a message containing HTML such as
  `<img src=x onerror=...>` or `<script>`
- **THEN** every participant sees that text literally, and nothing in
  it is executed or rendered as an element

#### Scenario: Remote images are not loaded
- **WHEN** a message contains Markdown image syntax pointing at a
  remote URL
- **THEN** no request is made to that URL and no image is displayed

#### Scenario: Only http and https links are followed
- **WHEN** a message contains a link
- **THEN** it is clickable only if it uses `http` or `https`, and it
  opens in a new context that cannot access the room page; a link with
  any other scheme (such as `javascript:`) is shown as plain text

#### Scenario: Line breaks are preserved
- **WHEN** a participant sends a multi-line message, including pasted
  code that isn't in a fence
- **THEN** each line appears on its own line rather than being joined
  into one paragraph
