-- Strudel documentation knowledge chunks (add-knowledge-store), reconciled
-- from content/knowledge/strudel.json on every deploy
-- (scripts/sync-knowledge.mjs) — the same pattern patterns/pattern_tags
-- already use for the curated pattern catalog. See design.md decision 1.
--
-- Nothing else writes these tables, so a chunk id absent from the
-- corpus file is simply pruned; there is no `origin` column to guard
-- the prune the way `patterns` needs one (see design.md, Risks).

CREATE TABLE knowledge_chunks (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,   -- 'function' | 'concept' | 'example'
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  text       TEXT NOT NULL,
  source_url TEXT,
  license    TEXT NOT NULL,
  version    TEXT NOT NULL
);

CREATE TABLE knowledge_chunk_tags (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  tag      TEXT NOT NULL,
  PRIMARY KEY (chunk_id, tag)
);

CREATE INDEX idx_knowledge_chunk_tags_tag ON knowledge_chunk_tags(tag);

-- A function chunk's alternate names (add-strudel-knowledge-corpus's
-- @synonyms) — looking one up resolves to the same chunk as its id.
CREATE TABLE knowledge_chunk_synonyms (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  synonym  TEXT NOT NULL,
  PRIMARY KEY (chunk_id, synonym)
);

CREATE INDEX idx_knowledge_chunk_synonyms_synonym ON knowledge_chunk_synonyms(synonym);

-- `types` is a JSON array of type-name strings (e.g. ["number","Pattern"])
-- — D1/SQLite has no array column. Unread until add-jah-knowledge-retrieval.
CREATE TABLE knowledge_chunk_params (
  chunk_id    TEXT NOT NULL REFERENCES knowledge_chunks(id),
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  types       TEXT,
  description TEXT,
  PRIMARY KEY (chunk_id, position)
);

CREATE TABLE knowledge_chunk_examples (
  chunk_id TEXT NOT NULL REFERENCES knowledge_chunks(id),
  position INTEGER NOT NULL,
  code     TEXT NOT NULL,
  PRIMARY KEY (chunk_id, position)
);
