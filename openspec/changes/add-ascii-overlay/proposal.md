## Why

Composition Room already has a `@strudel/draw`-driven visual backdrop
(scope, spectrum) but nothing purely decorative or humor-driven. A
toggleable ASCII-art layer — sourced from asciiart.eu's ~12,000-piece
gallery, swapped as the room plays — is a low-effort, high-fun addition
that reuses the room's existing canvas/backdrop plumbing rather than
building new UI infrastructure.

## What Changes

- **A toggleable ASCII-art panel** in the Composition Room, docked
  beside the editor the same way the existing participants/chat panel
  is — the editor shares width with it rather than being covered. A
  header toggle button (beside the existing `toggle-panel-button`)
  shows/hides it, independently of the chat panel (both can be open at
  once on wide screens); the toolbar itself is never covered. The panel
  keeps a solid, editor-matching background at every screen size,
  rather than blending into the page the way the chat panel does on
  desktop.
- **Attribution kept**: each displayed piece shows its artist/title as
  a link back to its `asciiart.eu` source page, per that site's stated
  request to keep attribution attached to reused art.
- **Dynamic font-size scaling** so pieces of any character
  width/height fit the pane without manual tuning.
- **A one-time scrape of asciiart.eu** into a new `ascii_art` table in
  `PATTERNS_DB` — the running app never calls asciiart.eu itself; all
  art is served from local data.
- **Beat-driven swapping**: while the room plays, the displayed piece
  advances every Nth Strudel scheduler event (N a fixed, non-user-facing
  parameter), cycling through a locally-cached random batch fetched
  once per overlay session — no network call on the hot path.
- **Delivered in three sequential slices** (UI with two fixed fixtures
  → full scrape into production data → beat-driven wiring against real
  data), so the visual design can be iterated on before the scrape runs
  and before beat logic is wired to it.

Explicitly out of scope: category-filtered/themed selection, a
user-facing settings UI (opacity, swap cadence), and any live/on-demand
fetch from asciiart.eu at runtime.

## Capabilities

### New Capabilities

- `ascii-overlay`: the scraped ASCII-art dataset, random-batch
  selection, and the beat-driven swap rule that picks what the overlay
  shows and when it changes.

### Modified Capabilities

- `composition-room`: the room gains a toggleable ASCII-art panel
  (independent of the chat panel, off by default) docked beside the
  editor, with its own toggle control alongside the existing panel
  toggle.

## Impact

- **New migration**: `migrations/patterns/0007_ascii_gallery.sql` —
  `ascii_art` table in the existing `PATTERNS_DB`.
- **New scraping tooling**: `scripts/scrape-ascii-gallery.mjs` +
  `scripts/lib/ascii-gallery-scraper.mjs` — a manual, one-off operator
  command (not wired into `npm run deploy` or `db:migrate:*`).
- **New read model**: `server/catalog/asciiArt.ts`.
- **New endpoints**: `GET /api/ascii-art/random`, `GET
  /api/ascii-art/[id]`.
- **Modified**: `app/pages/app/composition/[id].vue` (docked panel
  markup, toggle button, font-scaling, beat-count-gated swap wired to
  the existing Strudel scheduler event stream).
- **No dependency** on the in-flight `add-jah-chat` change; sequenced
  after it in the changes list but independent of it.
