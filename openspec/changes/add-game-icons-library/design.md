## Context

jaime already bundles one Iconify collection locally: `@iconify-json/lucide`,
configured in `nuxt.config.ts`'s `icon` block with `serverBundle: 'local'`
and a `clientBundle` combining automatic template scanning with an
explicit list for icons referenced only from `.ts` files, plus
`fallbackToApi: false` — the Cloudflare Worker cannot reach the Iconify
API at request time. `@iconify-json/game-icons` is the same kind of
package (an Iconify JSON collection), so it fits the same mechanism
without introducing a new one. Separately, jaime already has a
precedent for third-party attribution: the `ascii-overlay` capability
shows the artist name (or "unknown") and a source link alongside every
displayed ASCII-art piece, rather than a single blanket credit
somewhere else. Game-icons.net attribution should follow that same
shape — per-item, shown where the item is used — once something
actually uses an icon from it.

## Goals / Non-Goals

**Goals:**
- Make the collection available the same way lucide already is, with
  no behavior change to lucide or the existing bundling config beyond
  adding a second collection.
- Establish the attribution *mechanism* now, even with nothing to
  attribute yet, so the first real usage doesn't also have to invent
  where attribution lives.

**Non-Goals:**
- Choosing where in jaime any game-icons.net icon actually appears —
  no page or feature is in scope here (see proposal.md).
- A generic "credits page" — jaime's established pattern
  (`ascii-overlay`) attributes inline, next to the thing attributed,
  not in one central list. This change doesn't force a page into
  existence before there's content to attribute.

## Decisions

**Add the collection to the existing `icon` config, not a parallel
mechanism — but bundle it as a *subset*, unlike lucide.** Same
`clientBundle`/`serverBundle`/`fallbackToApi: false` shape as lucide.
The one difference was found by measurement while implementing: with
`serverBundle: 'local'` (and equally with `collections: ['game-icons']`)
`@nuxt/icon` embeds each collection *whole* as a Worker chunk. The
game-icons JSON is ~6.4 MB (~2.8 MB gzipped) — measured: the Worker
grew 6.5 → 12.8 MB for zero icons in use, and would threaten the
Worker size limit. So:

- `serverBundle` switches from `'local'` to an explicit
  `collections: ['lucide', <game-icons subset>]`. Lucide's chunk is
  byte-identical to before (522,221 bytes); installing any other
  `@iconify-json/*` set no longer bundles it silently.
- The game-icons subset is built at config time with `getIcons()` from
  `@iconify/utils` (new devDependency) from one list,
  `GAME_ICONS_IN_USE` in `nuxt.config.ts`. That same list feeds the
  `clientBundle.icons`, so an icon named only in a `.ts` file is
  covered on the client too.
- While the list is empty no game-icons data is bundled at all
  (Worker back to baseline). Verified with a throwaway page rendering
  one icon: SSR HTML carries the icon and its CSS, the client renders
  it, and no request goes to Iconify's API.

**Attribution record starts as a small structured placeholder (e.g. a
JSON or Markdown file listing icon → author), not a page.** Since
jaime's precedent is inline per-usage attribution, the record's real
display location is decided by whatever feature first uses an icon
from the set — this change only needs the record to exist and be
correct, not to be rendered anywhere yet. Concretely: a file such as
`content/credits/game-icons.md` (or similar, matching jaime's existing
`content/` conventions) that starts empty and gains one entry per icon
name + author as icons are adopted.

**No allowlist of "approved" icons.** Any icon from the collection can
be used; the constraint is that using one requires adding its
attribution entry, enforced by convention (documented in this
capability's spec) rather than a build-time check — a build-time
check would need to parse every template for `game-icons:*` icon
names, which is more machinery than a ~4,133-icon set that starts at
zero usages currently justifies.

`GAME_ICONS_IN_USE` is a bundling list, not an approval list — but it
does mean adopting an icon takes two edits, the list entry (or the
icon does not render) and the attribution row. The record file
(`content/credits/game-icons.md`) documents both steps. A missing list
entry fails visibly (no icon), unlike a missing attribution row, so
the list itself is self-enforcing.

## Risks / Trade-offs

- **Attribution record drifts from actual usage** (an icon gets used,
  the record isn't updated) → no automated enforcement in this change;
  mitigated by the spec requirement making it an explicit, checkable
  expectation for reviewers, same trust level as other manually-kept
  jaime conventions. Revisit with a lint/CI check only if drift
  actually happens in practice.
- **Bundle size** → the client bundle only includes icons referenced
  by name (scanned or listed). The server bundle would embed the whole
  collection, so game-icons is bundled as a subset of
  `GAME_ICONS_IN_USE` (see Decisions). Residual risk: a `game-icons:*`
  name used in code but missing from the list renders blank; the
  credits record's "Adding an icon" steps call this out.
