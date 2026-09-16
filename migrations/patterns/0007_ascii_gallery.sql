-- Scraped ASCII-art catalog for the Composition Room's ASCII panel
-- (add-ascii-overlay). Populated by scripts/scrape-ascii-gallery.mjs —
-- a manual, one-off operator command, never run on deploy/migrate.
--
-- `id` reuses asciiart.eu's own `data-id` verbatim (natural key).
-- `width`/`height` are the piece's character-grid dimensions (from the
-- site's `data-width`/`data-height`), used client-side to fit each
-- piece to the panel. `source_url` backs the required attribution link
-- — see design.md.

CREATE TABLE ascii_art (
  id           TEXT PRIMARY KEY,
  title        TEXT,
  artist       TEXT,
  category     TEXT NOT NULL,
  subcategory  TEXT NOT NULL,
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  text         TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  scraped_at   TEXT NOT NULL
);

CREATE INDEX idx_ascii_art_category ON ascii_art(category, subcategory);
