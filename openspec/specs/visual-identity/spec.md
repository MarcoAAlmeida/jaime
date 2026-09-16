# visual-identity Specification

## Purpose
Defines jaime's colour identity — a brand hue plus light/dark surfaces —
applied consistently across every layout shell so the hub reads as its
own product, not default Nuxt UI styling. The exact ramp values are
single-sourced in `design/tokens/` (`palette.css`, `colors.css`); this
spec fixes only the character each colour must keep.

## Requirements

### Requirement: Interactive Elements Use The Brand Hue
The system SHALL colour interactive and accent elements — buttons,
links, focus rings, text selection, active states — with jaime's brand
hue, a deep green, and SHALL NOT fall back to Nuxt UI's stock primary.
The brand hue SHALL meet WCAG AA contrast against whichever surface it
sits on, in both light and dark mode (≥ 4.5:1 for body text, ≥ 3:1 for
large text and UI shapes).

#### Scenario: A primary action is brand-green, not stock
- **WHEN** a user views a primary button or a link in either mode
- **THEN** it renders in jaime's green brand hue at AA-legible contrast,
  not Nuxt UI's default primary colour

### Requirement: Light Mode Uses A Tinted Pastel Surface, Not White
The system SHALL render the light-mode background as a low-chroma,
high-lightness tinted pastel — never plain white, and never a strong or
saturated tint.

#### Scenario: Light mode background is a soft tint
- **WHEN** a user views any page of the app in light mode
- **THEN** the background is a soft off-white tint, distinguishable from
  `#ffffff` and not a bold colour

### Requirement: Dark Mode Uses A Warm Near-Black, Not Navy
The system SHALL render the dark-mode background as a warm near-black —
the `graphite` neutral — with no navy or blue tint.

#### Scenario: Dark mode background is graphite, not navy
- **WHEN** a user views any page of the app in dark mode
- **THEN** the background renders as a warm near-black, with no navy or
  blue tint

### Requirement: The Identity Is Consistent Across Every Shell
The system SHALL apply the same brand hue, surfaces, and neutral across
all layout shells (landing, dashboard, docs) so no shell falls back to
default Nuxt UI styling.

#### Scenario: Every shell shares the identity
- **WHEN** a user moves between the landing page, a tool, and the docs
- **THEN** the brand hue, background surface, and neutral are the same
  in each
