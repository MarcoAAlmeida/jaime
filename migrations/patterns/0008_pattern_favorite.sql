-- Marks a pattern as eligible for the Composition Room's starter
-- picker (add-favorite-patterns). Independent of `origin`: a curated
-- or user-authored row can both be favorited.

ALTER TABLE patterns ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
