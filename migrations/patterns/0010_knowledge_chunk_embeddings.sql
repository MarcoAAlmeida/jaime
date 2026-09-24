-- Tracks which knowledge chunks have been embedded into the Vectorize
-- index and with what text (add-knowledge-search), so the deploy-time
-- reconcile can skip re-embedding a chunk whose embedded text hasn't
-- changed. See design.md decisions 3-4. The vectors themselves live only
-- in Vectorize, never in D1 — this table is bookkeeping, not content.

CREATE TABLE knowledge_chunk_embeddings (
  chunk_id    TEXT PRIMARY KEY REFERENCES knowledge_chunks(id),
  text_hash   TEXT NOT NULL,
  embedded_at TEXT NOT NULL
);
