-- Script-context visibility on `ai_usage` (add-jah-script-context).
--
-- `script_chars_sent` is the character count actually included in a
-- reply's context (the room's script, possibly trimmed around the
-- asker's own selection — see server/jah/scriptContext.ts). Always `0`
-- for JAH_E2E, matching how `embedding_tokens` (migration 0011) is
-- always `0` for its own accepted-simplification reason.

ALTER TABLE ai_usage ADD COLUMN script_chars_sent INTEGER NOT NULL DEFAULT 0;
