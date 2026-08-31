-- Catalog context — user accounts + passwordless auth. See
-- openspec/changes/add-user-auth/design.md (decision 3).

CREATE TABLE users (
  id                   TEXT PRIMARY KEY,       -- nanoid
  email                TEXT NOT NULL UNIQUE,   -- normalised: trim + lowercase
  display_name         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed'
  created_at           TEXT NOT NULL,          -- ISO-8601
  last_auth_request_at TEXT                    -- throttle window; NULL until first request
);

-- SHA-256 hex of the raw magic-link token — the raw value is never
-- stored. One unused row per user at a time (issuing a new link deletes
-- the prior unused one).
CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,   -- opaque random id, carried in the jaime_session cookie
  user_id      TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL       -- slides forward on use
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
