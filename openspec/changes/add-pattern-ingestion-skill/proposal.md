## Why

The curated Pattern Library grows by hand: someone finds a Strudel pattern
somewhere, works out how to get its code, reformats it, guesses the
attribution, writes the manifest file, and hopes it plays. Each step has
already gone wrong once — three `amen` patterns sat in the library making
no sound because their copies dropped a `samples()` line, and links
copied from strudel.cc sometimes carry no code at all (a short link is
only an id). An earlier attempt at this (`add-favorite-patterns` tasks
7.1–7.4, dropped) assumed a base64 decode and a direct database write; both
assumptions have since been overtaken (the repo manifest is the single
source of truth and CI deploys it).

A Claude Code skill can do the judgment parts — attribution, titles,
tags, reading a page — while small scripts do the deterministic parts,
and a playback check keeps silent or broken patterns out.

## What Changes

- **A new skill, `add-patterns`** (`.claude/skills/add-patterns/`): given a
  concrete source, it resolves it to Strudel code, judges attribution
  (asking the developer when unclear, with options), checks that the
  pattern plays, proposes the entries in one review table, and on
  approval writes `content/patterns/<id>.md`. It changes the repository
  only; the next deploy reconciles the database. It ends with a local
  commit at most — never a push.
- **Concrete sources only.** A strudel.cc link (with the code in the URL
  or a short link that stores it elsewhere), a raw/gist/GitHub file, a
  GitHub repository or directory (bulk), a documentation page with code
  in it, a local file, or pasted code with its source. An open-ended
  request with no source ("add some songs by X") is answered by asking
  for one.
- **Helper scripts in the repo** (`scripts/patterns/`, with npm entries so
  they work without Claude and CI can use them): `resolve`, `check`,
  `write`, `tags`.
- **Fidelity is a rule.** Code is stored as found — comments and
  formatting kept; only line endings normalise to LF. That requires the
  manifest reader to cope with code that itself contains triple
  backticks (today it would truncate).
- **Playback must pass.** No eval error and no sound that isn't loaded,
  checked in the real engine. Failures are reported with reasons and not
  written. A pattern that needs code from outside its own file is
  reported and the developer is asked what to do.
- **The playback test gains a fast path** for checking specific patterns
  (and only what changed), so a bulk import doesn't blow the CI timeout.
- **A wrong example is corrected:** the `Sample Playback` requirement cites
  `amen` as part of the default sample map; it isn't (it lives in
  yaxu/clean-breaks). The requirement now says packs outside the default
  map are loaded by the pattern itself.

Out of scope: any change to the Pattern Library UI or search (including
searching by author); direct database writes; an in-app "add pattern"
form; pushing or deploying.

## Capabilities

### New Capabilities

- `pattern-ingestion`: how a pattern gets from an external source into the
  library — sources accepted, resolution, fidelity, source and attribution
  recording, the playback gate, review before writing, repeatability, and
  what the workflow touches.

### Modified Capabilities

- `pattern-library`: the manifest carries a pattern's code exactly as
  written, including code that contains triple backticks.
- `frontend-editor`: `Sample Playback` no longer claims `amen` is in the
  default map, and says patterns needing another pack load it themselves.

## Impact

- New: `.claude/skills/add-patterns/` (`SKILL.md`, `references/`),
  `scripts/patterns/` (`resolve`, `check`, `write`, `tags`) with unit
  tests and saved-response fixtures.
- `scripts/lib/patterns-manifest.mjs`: fence-length-aware code extraction;
  `e2e/pattern-playback.spec.ts`: id filter and changed-only mode, sharing
  its missing-sound detection with `check`.
- `content/patterns/README.md`: document adding patterns via the skill.
- No schema, protocol, or runtime change. Nothing here deploys by itself;
  new patterns ship on the next push, as today.
