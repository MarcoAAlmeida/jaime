## Context

Composition Room (`app/pages/app/composition/[id].vue`) already has
two relevant pieces of layout machinery:

1. A `@strudel/draw` backdrop `<canvas>` behind the (transparent)
   editor text, inside a `rootEl` container:

   ```html
   <div ref="rootEl" class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
     <canvas ref="canvasEl" class="pointer-events-none absolute inset-0 z-0 size-full" />
     <div ref="editorEl" class="relative z-10 min-h-0 flex-1 overflow-hidden" />
   </div>
   ```

   A `ResizeObserver` on `rootEl` keeps that canvas's pixel buffer
   matched to the pane's displayed size.

2. A docked participants/chat panel, sibling to `rootEl` inside a
   shared flex row (`<div class="relative flex min-h-0 flex-1 gap-3">`):

   ```html
   <aside
     v-show="panelOpen"
     class="bg-elevated border-default absolute inset-y-0 right-0 z-30 flex w-72 max-w-[85vw] shrink-0 flex-col gap-3 rounded-l-md border-l p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-xl md:static md:w-56 md:max-w-none md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pb-0 md:shadow-none"
     data-testid="side-panel"
   >
   ```

   On `md+` this becomes a `static`, transparent column docked beside
   the editor (shrinking it via the shared flex row); below `md` it
   becomes an `absolute`, full-height overlay sheet with a solid
   `bg-elevated` background. `panelOpen` defaults to `true` on `md+`
   and `false` below it (set via `matchMedia` on mount).

The header row (containing `toggle-panel-button` and friends) is a
sibling above this flex row, not inside it — nothing docked or
overlaid within the row can ever reach it. The room already exposes a
Strudel scheduler event stream used for pattern-event highlighting
(`add-strudel-parity`) — the same stream this change hooks for
beat-driven swapping.

The user reviewed a reference screenshot (an IDE diff panel: solid,
right-aligned, chrome-matched to the editor) and asked for that
layout rather than a full-bleed overlay on top of the code — a docked
panel, editor sharing width with it, not a takeover.

asciiart.eu was mapped by direct crawling during proposal research: 27
top-level category pages (pure indexes, no art) link to ~392 leaf
subcategory pages. Each leaf page renders every piece inline, no
pagination, as
`<div class="card art-card" data-id data-title data-artist data-height
data-width data-views>` wrapping a `.art-card__ascii` div holding the
raw text. Sampled subcategories held 6–84 pieces (avg ~31); estimated
total ~12,000 pieces, ~15–20MB as text + metadata. Individual
`/art/<id>` pages exist as a client-side share route only — not needed
for the crawl.

`PATTERNS_DB` is the existing shared D1 database (patterns, users,
sessions, `ai_usage`). This change adds one more table to it rather
than provisioning a new database.

## Goals / Non-Goals

**Goals:**
- Get the panel's visual design right early (slice 1) with cheap,
  disposable fixture data, before investing in the scrape.
- Get real data fully loaded into production (slice 2) before any
  runtime code depends on it, so slice 3 is wired against reality from
  the start rather than against mocks.
- Never make the running app depend on asciiart.eu's availability —
  the scrape is a one-time ETL, not a live integration.

**Non-Goals:**
- Category browsing, filtering, or any curation UI.
- A settings UI for opacity — a fixed constant chosen once and
  adjusted in code if it looks wrong, matching this project's general
  bias against speculative configurability. (Swap cadence is the one
  exception — see the per-viewer interval decision below.)
- Re-scraping automatically on a schedule. A future re-run is a manual
  operator action, same as the first run.
- Syncing the swap-interval setting across participants — it is
  explicitly per-viewer, not room state.

## Decisions

**Panel is a docked flex sibling, not an overlay on top of the
editor.** Per the user's reference screenshot, the ASCII panel follows
the existing chat `<aside>`'s mechanic (a sibling inside the shared
`flex` row containing `rootEl`) rather than the scope/spectrum
backdrop's mechanic (`absolute inset-0` inside `rootEl`, layered over
the editor). Docking beside the editor means the editor genuinely
shares width with it — no z-index layering, no `pointer-events-none`
carve-outs — because it never sits on top of anything. Because the
header row is a sibling *above* this flex row, the panel is
structurally incapable of covering the toolbar regardless of its
width or open state.

**Independent of the chat panel, not shared/tabbed with it.** Its own
`showAsciiPanel` ref and its own toggle button, so a participant can
have chat open, ASCII open, both, or neither. On `md+` both dock side
by side in the same flex row (editor shrinks further with two panels
open); below `md`, where the chat panel becomes a full-height overlay
sheet, opening the ASCII panel closes the chat sheet and vice versa
(and each panel's toggle reflects this) — two full-width sheets
stacked or overlapping on a phone would be worse than requiring one at
a time.

**Solid, editor-matching background at every breakpoint — unlike the
chat panel.** The existing chat `<aside>` goes `md:bg-transparent`,
blending into the page on desktop and only becoming a solid
`bg-elevated` sheet below `md`. The ASCII panel keeps `bg-elevated` (or
equivalent) at every breakpoint, since the reference screenshot's
appeal was specifically a distinct, editor-chrome-matched panel, not a
transparent column.

**Content chrome (opacity, pointer-events) mostly falls away with the
docked-panel shape.** The original full-bleed-overlay design needed
`bg-black/75` and `pointer-events-none` because it sat on top of live,
interactive content. A docked panel is ordinary UI — solid background,
fully interactive, no transparency trick needed. The attribution link
is just a normal link within it.

**Font-size scaling: computed, not measured.** Each stored piece
carries its own `width`/`height` (character grid dimensions, copied
from the site's `data-width`/`data-height`). The panel computes a font
size from its own current pixel size (a `ResizeObserver` on the panel
element, same technique already used for the backdrop canvas's
`syncCanvasSize()`) against those dimensions, clamped to a fixed
min/max (6px–48px) so extreme pieces stay legible-but-bounded. This
avoids DOM measurement entirely and re-runs on both resize and on
every piece swap.

**Data lives in `PATTERNS_DB`, one new table.** `ascii_art` (id, title,
artist, category, subcategory, width, height, text, source_url,
scraped_at), indexed on `(category, subcategory)` even though v1 never
filters by them — cheap to add now, avoids a migration later if
category ever matters. `id` reuses the site's own `data-id` verbatim
(natural key, avoids inventing one).

**Selection: `ORDER BY RANDOM() LIMIT n` server-side, batched
client-side.** At ~12k rows this is fast enough with no special
indexing. The client fetches a batch (`GET
/api/ascii-art/random?count=n`) once per panel session and cycles
through it locally on each beat-gated swap, refetching only when the
batch is exhausted — so the swap itself, which happens on a musical
cadence, never depends on network latency.

**Beat gating: a modulo on the existing scheduler event count, not new
beat-detection.** `add-strudel-parity` already exposes a per-event
callback used for pattern highlighting. This change adds one more
subscriber: a running counter, advancing the panel when `count % N ===
0`. `N` counts scheduler events, not wall-clock time, so the cadence
naturally follows the room's tempo/pattern density rather than needing
separate BPM plumbing.

**`N` is a per-viewer setting, not a fixed constant.** Unlike opacity
(genuinely fine as a one-off code value), swap cadence is something a
person watching wants to tune to taste in the moment — so it's a
plain reactive `ref` in the component, adjustable via a small control
in the panel (a stepper/slider), defaulting to a fixed value (chosen
by ear during implementation) and optionally remembered per-browser in
`localStorage` for convenience. It is never sent over the WS
connection or stored in room state — purely local, per-viewer UI
state, consistent with this being a decorative layer rather than
something the room needs to agree on.

**The scrape is a manual operator command, never deploy-hooked.**
Unlike `scripts/sync-patterns.mjs` (which reconciles a manifest *this
project* owns, safe to run on every deploy), this crawler hits a
third-party site ~392 times. It is invoked by hand
(`node scripts/scrape-ascii-gallery.mjs [-- --remote]`), rate-limited
(~1–2 req/sec), and checkpointed so an interrupted run can resume
without re-fetching completed subcategory pages.

## Risks / Trade-offs

- **asciiart.eu's markup could change**, breaking the parser silently
  (e.g., zero pieces scraped without error) → the crawl script asserts
  a minimum plausible piece count per subcategory and fails loudly
  rather than silently writing an empty dataset.
- **A one-time scrape means the local dataset drifts from the live
  site** (new pieces never appear, removed pieces linger) → acceptable
  per this change's non-goals; a future manual re-run is the fix, not
  automation.
- **Fixed `N` may not suit every room's tempo** → deliberately accepted; both are one-line code changes if
  they prove wrong, not worth a settings surface at this scale.

## Migration Plan

1. Slice 1 ships UI-only (fixture data, no migration, no scrape) — no
   production data dependency, safe to deploy and iterate on
   immediately.
2. Slice 2 adds migration `0007_ascii_gallery.sql` and runs the crawl
   against remote D1 before slice 3 begins; the panel UI is
   unaffected by this slice (still showing slice-1 fixtures) until
   slice 3 switches it over.
3. Slice 3 swaps the panel's data source from fixtures to the new
   `/api/ascii-art/random` endpoint and wires the beat-gated advance.
   Rollback at any point is a redeploy of the prior slice's code; the
   `ascii_art` table is additive and never touched by unrelated
   features, so no rollback of the migration itself is anticipated.
