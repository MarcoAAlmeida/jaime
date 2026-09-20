## Why

jaime-games (a sibling project sharing jaime's visual identity) is
adopting the [game-icons.net](https://game-icons.net) icon set for
board/game iconography. Making the same set available in jaime keeps
the two projects able to draw from one shared icon vocabulary, and
jaime may want game-themed icons of its own later (e.g. a teaser for
the upcoming games tool) without a second decision about which library
to use.

## What Changes

- Add the `@iconify-json/game-icons` collection (~4,133 icons, CC BY
  3.0) alongside the existing `@iconify-json/lucide` set, bundled
  locally the way lucide already is (`clientBundle` with `scan` + an
  explicit icon list, `fallbackToApi: false`) — Workers can't reach the
  Iconify API at runtime, so nothing about this can depend on a network
  fetch. Server-side it is bundled as a subset of the icons in use
  rather than whole (the collection alone is ~2.8 MB gzipped); see
  design.md.
- This is a general library addition, not tied to a specific page —
  no game-icons.net icon is used anywhere in jaime yet.
- Add a credits/acknowledgments location that lists which specific
  game-icons.net icons and their individual authors are in use.
  CC BY 3.0 requires per-icon attribution (the set is contributed by
  many different artists, not covered by one blanket credit line).
  Starts as an empty/placeholder scaffold since no icons are consumed
  yet, and is populated each time a game-icons.net icon is actually
  used going forward.

## Capabilities

### New Capabilities
- `icon-library`: jaime bundles icon sets locally (no runtime API
  dependency) and maintains per-icon attribution for any set whose
  license requires it.

### Modified Capabilities
(none)

## Impact

- Affected code: `nuxt.config.ts` (`icon` config), `package.json`
  (new dependency), a credits/acknowledgments page or section.
- No existing icon usage (lucide) changes behavior; this is additive.
- No runtime cost beyond bundle size for whichever icons are actually
  in use (client and server bundles include only those, not the full
  collection).
