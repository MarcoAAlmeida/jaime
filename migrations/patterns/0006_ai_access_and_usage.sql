-- @jah access control + usage visibility (add-admin-console).
--
-- `users.ai_access` is a per-user manual grant the operator flips from
-- /admin. Effective access is that flag OR the account's GitHub login
-- being in the AI_ACCESS_LOGINS env list (resolved at read time, never
-- written here) — see design.md decision 1.
--
-- `ai_usage` is written by add-jah-chat (Phase 1), one row per model
-- call. `github_login` is denormalized so the record survives account
-- deletion for billing attribution (design.md decision 6).

ALTER TABLE users ADD COLUMN ai_access INTEGER NOT NULL DEFAULT 0;

CREATE TABLE ai_usage (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  github_login       TEXT,
  room_id            TEXT,
  model              TEXT NOT NULL,
  prompt_tokens      INTEGER NOT NULL DEFAULT 0,
  completion_tokens  INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd  REAL NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);

CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at);
CREATE INDEX idx_ai_usage_user_id ON ai_usage(user_id);
