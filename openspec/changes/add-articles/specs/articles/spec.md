## Purpose

The Explanation-type content jaime publishes — long-form, screenshot-
rich pieces exploring the ideas and research behind a feature, as
distinct from Docs' terse Reference material. Discoverable from both
the home page and a full index; never organized into a forced
nav-tree hierarchy.

## ADDED Requirements

### Requirement: Articles Are Reachable From Both Home And A Full Index
The system SHALL surface articles from a section on the home page
(teaser cards) and from a standalone index listing every article. Both
SHALL link into the same per-article page.

#### Scenario: A visitor discovers an article from the home page
- **WHEN** a visitor views the home page
- **THEN** a section lists article teasers, and clicking one opens that
  article

#### Scenario: A visitor browses the full list
- **WHEN** a visitor opens the articles index
- **THEN** every published article is listed, each linking to its own
  page

### Requirement: An Article Is A Standalone Page, Not Organized Into A Nav Tree
The system SHALL render each article at its own URL with no forced
category hierarchy or sidebar navigation tree, distinguishing Articles
from the Docs shell's nav-tree structure.

#### Scenario: Opening an article shows no forced sibling nav
- **WHEN** a visitor opens an article
- **THEN** the page shows that article's content, without a sidebar nav
  tree grouping it under a fixed category

### Requirement: An Article Can Require Authentication
The system SHALL support marking an article as requiring
authentication: it stays listed (with a lock indicator) in both the
home teaser section and the full index, but its content is served only
to signed-in users. A signed-out visitor who opens it SHALL see an
explanation and a path to sign in rather than the content or a dead
end.

#### Scenario: A locked article is still listed
- **WHEN** a signed-out visitor views the home teasers or the articles
  index
- **THEN** an auth-required article is listed, marked as locked

#### Scenario: A signed-out visitor sees the explainer, not the content
- **WHEN** a signed-out visitor opens an auth-required article
- **THEN** they see a message that the article requires signing in and
  a control to sign in, and the article's body content is not present
  in the response

#### Scenario: A signed-in visitor reads the article normally
- **WHEN** a signed-in visitor opens an auth-required article
- **THEN** the article renders its content like any other article
