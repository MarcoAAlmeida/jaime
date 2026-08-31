## ADDED Requirements

### Requirement: A Doc Page Can Require Authentication
The system SHALL support marking a doc page as requiring
authentication: its nav entry stays visible with a lock indicator, its
content is served only to signed-in users, and a signed-out user who
opens it sees an explanation and a path to sign in rather than the
content or a dead end.

#### Scenario: Locked page is still listed in the nav
- **WHEN** a signed-out user views the docs nav tree
- **THEN** an auth-required page is listed, marked as locked

#### Scenario: Signed-out user sees the explainer, not the content
- **WHEN** a signed-out user opens an auth-required doc page
- **THEN** they see a message that the page requires signing in and a
  control to sign in, and the page's body content is not present in the
  response

#### Scenario: Signed-in user reads the page normally
- **WHEN** a signed-in user opens an auth-required doc page
- **THEN** the page renders its content like any other doc page
