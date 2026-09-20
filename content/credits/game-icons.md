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

`lion` is `@jah`'s avatar (`public/jah-avatar.svg`) — recoloured red on a
round badge, with the credit in the file's metadata and in the avatar's
tooltip. The avatar is a static file, not rendered through `UIcon`; the
homepage additionally renders the plain `lion` icon through `UIcon`, so
it is also in `GAME_ICONS_IN_USE`.

The homepage (`app/pages/index.vue`) credits each icon it uses in a line
at the foot of the page, generated from one icon → author list.

| Icon | Author | Source |
| ---- | ------ | ------ |
| `lion` | Lorc | [game-icons.net/1x1/lorc/lion.html](https://game-icons.net/1x1/lorc/lion.html) |
| `chat-bubble` | Delapouite | [game-icons.net/1x1/delapouite/chat-bubble.html](https://game-icons.net/1x1/delapouite/chat-bubble.html) |
| `musical-notes` | Delapouite | [game-icons.net/1x1/delapouite/musical-notes.html](https://game-icons.net/1x1/delapouite/musical-notes.html) |
| `laptop` | Delapouite | [game-icons.net/1x1/delapouite/laptop.html](https://game-icons.net/1x1/delapouite/laptop.html) |
| `rune-stone` | Lorc | [game-icons.net/1x1/lorc/rune-stone.html](https://game-icons.net/1x1/lorc/rune-stone.html) |
| `scroll-unfurled` | Lorc | [game-icons.net/1x1/lorc/scroll-unfurled.html](https://game-icons.net/1x1/lorc/scroll-unfurled.html) |
| `campfire` | Lorc | [game-icons.net/1x1/lorc/campfire.html](https://game-icons.net/1x1/lorc/campfire.html) |
| `sound-waves` | Skoll | [game-icons.net/1x1/skoll/sound-waves.html](https://game-icons.net/1x1/skoll/sound-waves.html) |
| `console-controller` | Skoll | [game-icons.net/1x1/skoll/console-controller.html](https://game-icons.net/1x1/skoll/console-controller.html) |
