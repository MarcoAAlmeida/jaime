# landing-page Specification

## Purpose
Provides jaime's real entry point at the site root — the developer
hangout pitch with `@jah` as the headline, how to start a room or open
a starter pattern in one, and how to reach the docs — replacing JAM's
create/join screen as the site's landing experience.

## Requirements

### Requirement: Value Proposition Is Immediately Visible
The system SHALL present, above the fold at the site root, the tagline
"Your dev hangout — live-code, chat, and let @jah keep watch." together
with a short description of jaime as a place for developers to hang out
and chat.

#### Scenario: Visitor sees the value proposition without scrolling
- **WHEN** a visitor opens the site root
- **THEN** the tagline "Your dev hangout — live-code, chat, and let
  @jah keep watch." is visible without scrolling

#### Scenario: The page no longer pitches a hub of music tools
- **WHEN** a visitor reads the site root's headline, description, page
  title, and footer
- **THEN** none of them describe jaime as a hub of small music tools

### Requirement: One Primary Call To Action
The system SHALL present exactly one primary action, "Start a room",
that creates a new Composition Room and takes the visitor straight into
it, distinct from secondary links.

#### Scenario: Visitor finds the primary action without hunting
- **WHEN** a visitor views the landing page
- **THEN** exactly one call-to-action is styled as primary, and it is
  "Start a room"

#### Scenario: The primary action opens a fresh room
- **WHEN** a visitor clicks "Start a room"
- **THEN** they land in a newly created Composition Room, on its Chat
  tab

### Requirement: Docs Are Reachable From Landing
The system SHALL provide a link from the landing page directly to the
docs shell.

#### Scenario: Visitor reaches docs from landing
- **WHEN** a visitor clicks the docs link on the landing page
- **THEN** they land on the docs shell's Home section

### Requirement: Articles Are Surfaced From The Landing Page
The system SHALL present a section on the landing page listing article
teasers (title, description, and a cover image), each linking directly
to that article, distinct from the Tools section and the docs link.

#### Scenario: Visitor sees article teasers on the landing page
- **WHEN** a visitor views the landing page
- **THEN** a section lists teaser cards for published articles, and
  clicking one opens that article

### Requirement: Signup Is Reachable But Not Required
The system SHALL provide a path from the landing page to the community
signup screen, without requiring signup to use a tool.

#### Scenario: Visitor can reach signup without being blocked from tools
- **WHEN** a visitor clicks the primary call-to-action into a tool
  without having signed up
- **THEN** they reach the tool directly, with no signup gate in the way

### Requirement: Returning Visitor Has A Fast Path Back
The system SHALL provide a way for a returning visitor to reach the
Composition Room directly from the landing page, without re-reading the
marketing content.

#### Scenario: Returning visitor skips straight to the dashboard
- **WHEN** a visitor who has already used a room returns to the site
  root
- **THEN** a visible link/button takes them directly to the dashboard's
  Composition Room screen

### Requirement: The Hero Links To The Pattern Library
The system SHALL provide a secondary hero link straight to the Pattern
library, so a visitor who wants it never has to scroll to find it.

#### Scenario: Visitor jumps directly to the pattern library
- **WHEN** a visitor views the landing page hero
- **THEN** a secondary link labeled "Pattern library" goes directly to
  `/app/patterns`

### Requirement: `@jah` Is The Headline Of The Page
The system SHALL present, immediately after the hero, a prominent
section introducing `@jah` — shown as the red lion — covering what it is
(the AI participant in a room's chat), how to address it (`@jah`
followed by a question), and that access is invite-only for now. The
section SHALL offer an action that starts a room.

#### Scenario: Visitor meets @jah right after the hero
- **WHEN** a visitor scrolls past the hero
- **THEN** the next section introduces `@jah` with the red lion image
  and a description of what it does

#### Scenario: The section shows how to talk to @jah
- **WHEN** a visitor reads the `@jah` section
- **THEN** it shows the `@jah <question>` form of addressing it in chat

#### Scenario: The section is honest about access
- **WHEN** a visitor reads the `@jah` section
- **THEN** it states that `@jah` is invite-only for now

#### Scenario: The section leads into a room
- **WHEN** a visitor uses the `@jah` section's action
- **THEN** they land in a newly created Composition Room, on its Chat
  tab

### Requirement: Features Are Showcased With Icons
The system SHALL present a features section covering, at least, chat
with `@jah`, live Strudel coding together, the beat-synced ASCII art
panel, and the pattern library, with each feature carrying a
game-icons.net icon.

#### Scenario: Every feature card has an icon
- **WHEN** a visitor views the features section
- **THEN** each feature is shown with its own game-icons.net icon

### Requirement: Starter Patterns Open In A Composition Room
The system SHALL list the starter patterns on the landing page, and
each SHALL open a newly created Composition Room whose shared document
is that pattern's code, with no signup gate in the way. If the starter
patterns cannot be loaded, the section SHALL be omitted and the rest of
the page SHALL be unaffected.

#### Scenario: Visitor opens a starter pattern in a room
- **WHEN** a visitor uses the "Open in Composition Room" action on a
  listed starter pattern
- **THEN** a new Composition Room opens with that pattern's code as the
  shared document

#### Scenario: Starter patterns need no signup
- **WHEN** an anonymous visitor opens a starter pattern
- **THEN** they reach the room with the pattern loaded, with no signup
  gate

#### Scenario: A failed load leaves the page intact
- **WHEN** the starter patterns cannot be fetched
- **THEN** the starter-patterns section is not shown and every other
  section still renders

### Requirement: JAM Is Reachable Only From Low-Key Links
The system SHALL NOT feature JAM in the landing page's hero, features
section, or any call to action. JAM SHALL remain reachable from a
low-key link in the landing page's footer.

#### Scenario: JAM is absent from the prominent areas
- **WHEN** a visitor views the landing page hero, features section, and
  calls to action
- **THEN** none of them mention or link to JAM

#### Scenario: JAM is still reachable
- **WHEN** a visitor clicks the JAM link in the landing footer
- **THEN** they reach JAM's create/join screen

### Requirement: A Games Coming-Soon Notice
The system SHALL show a small notice on the landing page that games are
coming soon. The notice SHALL NOT link anywhere.

#### Scenario: Visitor sees the games notice
- **WHEN** a visitor views the landing page
- **THEN** a small notice says games are coming soon

#### Scenario: The notice is not a link
- **WHEN** a visitor interacts with the games notice
- **THEN** it does not navigate anywhere

### Requirement: Game Icons On The Page Are Credited Per Icon
The system SHALL credit, on the landing page itself, the author of each
game-icons.net icon the page uses, alongside the icon-library
attribution record.

#### Scenario: The page names each icon's author
- **WHEN** a visitor views the landing page
- **THEN** a credit line names the author of every game-icons.net icon
  used on the page and links to game-icons.net
