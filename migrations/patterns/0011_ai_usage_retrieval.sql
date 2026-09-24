-- Retrieval visibility on `ai_usage` (add-jah-knowledge-retrieval).
--
-- `retrieval_chunks_used` is `sources.length` for the reply this row
-- accounts for. `embedding_tokens` is reserved for the query-embedding
-- call's token count; Workers AI's embedding output carries no
-- usage/token field today (verified against the generated binding
-- types), so this column is always `0` for now — an accepted
-- simplification (design.md decision 4 / Risks), not a bug, until
-- Workers AI reports it or a separate estimate is worth adding.

ALTER TABLE ai_usage ADD COLUMN retrieval_chunks_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_usage ADD COLUMN embedding_tokens INTEGER NOT NULL DEFAULT 0;
