-- Marks which pattern rows the curated-catalog manifest owns.
-- `curated` rows are reconciled to content/patterns/*.md on every
-- deploy (scripts/sync-patterns.mjs); anything created another way
-- (future user-authored patterns) is inserted as `user` and left
-- alone by the reconcile.
--
-- Existing 0002 seed rows inherit the default and become manifest-
-- managed from the first sync.

ALTER TABLE patterns ADD COLUMN origin TEXT NOT NULL DEFAULT 'curated';

CREATE INDEX idx_patterns_origin ON patterns(origin);
