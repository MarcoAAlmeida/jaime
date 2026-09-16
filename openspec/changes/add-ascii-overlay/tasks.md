## 1. Slice 1 — Panel UI with two fixture pieces

- [x] 1.1 `app/pages/app/composition/[id].vue` — add a new `<aside>`,
      sibling to the existing chat `<aside>` inside the shared
      `flex` row (docks beside `rootEl`, editor shrinks to share
      width). Solid `bg-elevated` background at every breakpoint (does
      **not** go `md:bg-transparent` like the chat aside).
      `data-testid="ascii-panel"`.
- [x] 1.2 Two hardcoded fixture pieces (one small, one large — e.g. a
      ~10×5 and a ~50×25 character grid), each with `{ text, width,
      height, title, artist, sourceUrl }`, defined inline or in a small
      local constants file — not the database.
- [x] 1.3 Attribution element inside the panel: artist/title text
      linking to `sourceUrl`, pinned near the bottom of the panel.
- [x] 1.4 Header toggle button beside `toggle-panel-button`
      (`data-testid="toggle-ascii-panel-button"`), flipping a
      `showAsciiPanel` ref independent of `panelOpen`; off by default
      at every breakpoint.
- [x] 1.5 Mobile mutual exclusion: below `md`, opening the ASCII panel
      (an `absolute` full-height sheet, same mechanic as the chat
      panel below `md`) closes the chat panel if open, and vice versa;
      on `md+` both may be open simultaneously, docked side by side.
- [x] 1.6 Font-size scaling: compute the `<pre>`'s font size from the
      panel's own current size (a `ResizeObserver` on the panel
      element) against the current fixture's `width`/`height`, clamped
      to 6px–48px. Recompute on resize.
- [x] 1.7 A manual "next fixture" control (temporary, dev-only —
      e.g. a keyboard shortcut or a small button) to flip between the
      two fixtures on demand, so the user can compare small vs. large
      rendering without waiting for slice 3's beat logic. Remove once
      slice 3 lands, or gate behind `JAH_E2E`-style dev flag if kept
      for testing.
- [ ] 1.8 Playwright smoke check: toggling on/off shows/hides the
      panel, editor stays usable alongside it, header controls remain
      visible/clickable while it's on, chat/ASCII mutual exclusion
      holds below `md`.
- [x] 1.9 Manual review with the user in the browser; adjust panel
      width/background/scaling clamp values as directed before
      starting slice 2.

## 2. Slice 2 — Scrape asciiart.eu into production data

- [x] 2.1 `migrations/patterns/0007_ascii_gallery.sql` — create
      `ascii_art` (id, title, artist, category, subcategory, width,
      height, text, source_url, scraped_at) and
      `idx_ascii_art_category` on `(category, subcategory)`.
- [x] 2.2 `scripts/lib/ascii-gallery-scraper.mjs` — category-page
      walker (discover the ~392 subcategory URLs from the 27 top-level
      category pages) and subcategory-page parser (extract each
      `.art-card`'s `data-id`/`data-title`/`data-artist`/`data-width`/
      `data-height` and its `.art-card__ascii` text; build
      `source_url` as `https://www.asciiart.eu/art/<id>`).
- [x] 2.3 Parser safety: assert a minimum plausible piece count per
      subcategory page; fail loudly (non-zero exit, clear message)
      rather than silently writing an empty or truncated dataset.
- [x] 2.4 `scripts/scrape-ascii-gallery.mjs` — CLI entry point: polite
      rate limiting (~1–2 req/sec), a checkpoint file so an interrupted
      run resumes without re-fetching completed subcategories, batched
      `INSERT` SQL written to a temp file and applied via `wrangler d1
      execute PATTERNS_DB <target> --file` (mirrors
      `scripts/sync-patterns.mjs`'s shell-out pattern). Supports
      `--local`/`--remote`. Explicitly NOT added to `npm run deploy` or
      `db:migrate:*`.
- [x] 2.5 `npm run` alias for the crawl (e.g. `ascii:scrape [--
      --remote]`) in `package.json`, documented as a manual operator
      command.
- [x] 2.6 `scripts/lib/ascii-gallery-scraper.test.mjs` — unit tests for
      the HTML parser against saved sample fixtures (a couple of real
      subcategory pages captured to disk), not against the live site.
- [x] 2.7 Run `db:migrate:local` to apply `0007` locally; run the
      crawler against `--local` and sanity-check row counts/spot-check
      a few rows.
- [x] 2.8 Apply migration `0007` to remote D1; run the crawler against
      `--remote` end-to-end against production. Verify: total row count
      is in the expected ballpark (thousands, not zero or a handful),
      and spot-check several rows for correct title/artist/text/
      dimensions/source_url.
- [x] 2.9 `server/catalog/asciiArt.ts` — `getRandomAsciiArt(db, {
      count })`, `getAsciiArtById(db, id)`, `isMigrated(db)` (mirrors
      `server/catalog/patterns.ts`).
- [x] 2.10 `server/api/ascii-art/random.get.ts` —
      `GET /api/ascii-art/random?count=<n>`, clamping `count` to a
      sane max; returns a 503-style clean response if `isMigrated` is
      false.
- [x] 2.11 `server/api/ascii-art/[id].get.ts` — direct lookup by id.
- [x] 2.12 API unit/integration tests: random batch returns `count`
      distinct pieces with all fields populated; unknown id 404s;
      pre-migration returns the clean not-yet-available response.

## 3. Slice 3 — Beat-driven swapping against real data

- [ ] 3.1 Remove the slice-1 fixtures and the temporary "next fixture"
      dev control.
- [ ] 3.2 On panel-open (or room load if already toggled on), fetch
      a batch via `GET /api/ascii-art/random?count=<n>`; store it
      client-side and track a cursor into it.
- [ ] 3.3 Wire a subscriber to the existing Strudel scheduler event
      stream (the same one driving pattern-event highlighting from
      `add-strudel-parity`): increment a counter per event; when
      `count % N === 0` and the room is playing, advance the cursor
      (wrapping/refetching a new batch when exhausted) and update the
      displayed piece.
- [ ] 3.4 Do not advance while the room is stopped — gate the
      subscriber on the existing playback state.
- [ ] 3.5 Pick and hard-code `N` by ear during testing (a fixed
      constant, not a setting); note the chosen value and rationale in
      a short code comment.
- [ ] 3.6 Re-run the font-scaling computation (from slice 1) on every
      swap using the real piece's stored `width`/`height`.
- [ ] 3.7 Update the attribution link/text on every swap to the new
      piece's real artist/title/`source_url`.
- [ ] 3.8 Playwright e2e: with a stubbed/seeded `ascii_art` batch,
      confirm the panel advances after the expected number of
      scheduler events during playback and does not advance while
      stopped.
- [ ] 3.9 `nuxt typecheck`, `vitest run`, `playwright test` green.
- [ ] 3.10 `openspec validate add-ascii-overlay --strict`.
- [ ] 3.11 `npm run deploy`; manual verification on `jaime.stream`:
      toggle the panel in a live room, confirm real pieces render,
      scale correctly, and advance on the beat cadence during playback.
- [ ] 3.12 Sync the `ascii-overlay` and `composition-room` deltas;
      archive the change.
