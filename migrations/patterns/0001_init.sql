-- Catalog context — Pattern aggregate. See
-- openspec/changes/add-pattern-library/design.md (decision 3).

CREATE TABLE patterns (
  id            TEXT PRIMARY KEY,      -- nanoid
  title         TEXT NOT NULL,
  code          TEXT NOT NULL,         -- the Strudel snippet
  source_url    TEXT NOT NULL,         -- attribution: where it came from
  source_author TEXT,                  -- attribution: author, when known
  created_at    TEXT NOT NULL          -- ISO-8601
);

CREATE TABLE pattern_tags (
  pattern_id TEXT NOT NULL REFERENCES patterns(id),
  tag        TEXT NOT NULL,
  PRIMARY KEY (pattern_id, tag)
);

-- Tag filtering and the distinct-tag list both key off `tag`.
CREATE INDEX idx_pattern_tags_tag ON pattern_tags(tag);

-- Listing order (design decision 5): created_at DESC, id.
CREATE INDEX idx_patterns_created_at ON patterns(created_at DESC, id);
