-- GitHub OAuth sign-in + a minimal profile (add-oauth-signin).
--
-- All additive and nullable: existing magic-link accounts stay valid
-- with these columns NULL. `github_id` is the stable linkage key
-- (GitHub logins can change, ids can't); `avatar_url` is the GitHub
-- profile picture (host-restricted to avatars.githubusercontent.com by
-- the server); `github_login` is stored for the operator's user list
-- and refreshed on each sign-in.

ALTER TABLE users ADD COLUMN github_id INTEGER;
ALTER TABLE users ADD COLUMN github_login TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

CREATE UNIQUE INDEX idx_users_github_id ON users(github_id);
