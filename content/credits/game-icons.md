# game-icons.net icon credits

jaime bundles the [game-icons.net](https://game-icons.net) icon set
(`@iconify-json/game-icons`, ~4,100 icons) so it can be used wherever a
game-themed icon is wanted. The set is licensed
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) and is the work
of many individual artists — each icon must be credited to its own
author, not covered by one blanket line.

This file is the record of **which icons jaime actually uses, and who
drew each one**. It backs the per-icon attribution requirement in the
`icon-library` spec. It is not a page: attribution is shown inline,
next to the thing that uses the icon, the same way `ascii-overlay`
credits each ASCII-art piece — this record is the source of truth that
inline credit is written from.

## Adding an icon

Using a `game-icons:*` icon anywhere (template, component, or `.ts`
file) takes three steps, all in the same change:

1. Add the icon's bare name (no prefix) to `GAME_ICONS_IN_USE` in
   `nuxt.config.ts`. Without it the icon does not render, in dev or in
   production — the server bundle only contains listed icons.
2. Add a row below: the icon name, its author (shown on the icon's page
   at game-icons.net), and that page's URL.
3. Show the credit where the icon is used.

Removing the last use of an icon removes its row and its list entry.

## Icons in use

| Icon | Author | Source |
| ---- | ------ | ------ |
| _none yet_ | | |
