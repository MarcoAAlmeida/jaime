## Context

The curated catalog is `content/patterns/<id>.md` (YAML front matter + one
fenced code block). Every deploy — locally `npm run deploy`, and in CI
(Workers Builds runs `npm test` then `npm run deploy`, confirmed) —
reconciles `PATTERNS_DB` to those files: new file inserts, edit updates
(tags rebuilt, `created_at` kept), removed file deletes, only
`origin='curated'` rows are touched, an invalid file aborts the whole
reconcile. The id is the filename, so renaming a file is a delete plus an
add and breaks `?load=<id>` links.

Getting a pattern *into* that directory is manual. Two facts from this
project's own history shape the design:

- Silence is not an error. Three `s("amen")` patterns were in the library
  making no sound; `amen` is not in the default sample map. The playback
  e2e now fails on any `sound X not found` message, but only for patterns
  already in the catalog.
- "Resolve a link" is not "decode base64". strudel.cc links come as
  `#<base64>` (code in the URL) and as `?<hash>` (a short id; the code
  lives in Strudel's own backend). Patterns also live in repositories,
  gists, documentation pages and forum posts.

This supersedes `add-favorite-patterns` decision 5 (database-direct
ingestion, never built).

## Goals / Non-Goals

**Goals**

- Turn "here is a source" into reviewed, verified, faithful manifest
  entries with as little manual work as possible, in bulk when the source
  is a repository.
- Keep judgment (attribution, titles, tags, reading a page, asking) in the
  skill and everything deterministic in tested scripts.
- Keep silent and broken patterns out, by construction.
- Touch only the repository.

**Non-Goals**

- Library UI or search changes (searching by author is a separate,
  possible follow-up).
- Direct database writes; an in-app add form; pushing or deploying.
- Open-ended discovery ("find me songs by X").
- Deciding licences; attribution is by recording the source.

## Decisions

### 1. One skill, four repo helper scripts

Terminology: the workflow stages are **steps** inside `SKILL.md`; the
executable pieces are **helper scripts**. "Subskills" is not a thing — a
separate skill would be its own folder discovered on its own.

`.claude/skills/add-patterns/SKILL.md` plus `references/`
(`file-format.md`, `link-shapes.md`, `attribution.md`). The scripts live
in the repo under `scripts/patterns/` with npm entries, not inside the
skill folder, so a developer or CI can run them without Claude and the
skill is just their caller. They are independent, each testable on its
own:

| Script | In → out |
| --- | --- |
| `resolve <source>` | a link/path/repo/`-` (stdin) → JSON candidates `{ code, sourceUrl, hints:{title,author}, path, notes }`, or a coded "can't resolve, because…"; also flags a candidate already in the library (by source URL) and files that are evidently helpers, not patterns |
| `check <id…>` / `--code` | patterns → per-pattern `pass` or `error` / `missing sounds` / `depends on: …` |
| `write <spec.json>` | `{ id, title, tags, sourceUrl, author, favorite, code }` → writes/updates the file, validates with the manifest parser, syncs the local database, prints a summary |
| `tags` | the existing tags with counts (the vocabulary to reuse) |

### 2. The steps, and where judgment lives

Intake → Resolve → Vet → Check → Author → Confirm → Write → Hand off.

- **Deterministic (scripts):** decoding, fetching, listing a repo,
  running the engine, formatting the file, dedupe by source URL.
- **Judgment (the skill, i.e. the model):** what was handed over; reading
  a page when `resolve` can't; who the author is; a good title; which
  existing tags fit; whether a candidate is really a pattern.
- **Asking (the developer):** any real doubt — ambiguous authorship, a
  dependency outside the file, an id collision, an unresolvable source.
  Options are offered; the developer's answer is used. Nothing is written
  before the single review table is approved.

### 3. Resolving links

| Source | Method | Reliability |
| --- | --- | --- |
| `strudel.cc/#<base64>` | decode the fragment (plain base64 of the UTF-8 source) | offline, solid |
| `strudel.cc/?<hash>` | look the hash up in the store the REPL itself reads (verified working on a real link, incl. its `@title/@by/@license` header) | **fragile**: an undocumented backend and a public client key embedded in the site's JavaScript; the key is read from the live bundle at run time, never hard-coded; any failure degrades to "paste the code" |
| raw / gist / GitHub blob URL | fetch (blob URLs rewritten to raw) | solid |
| GitHub repo or directory | one tree listing, then raw fetches (no per-file API calls, so the unauthenticated rate limit isn't a factor); `.js`/`.strudel`/`.txt` candidates | solid; helper-looking files flagged |
| page with code in it (docs, blog, README) | not scripted — the skill reads the page and extracts blocks, passing them to `check`/`write` | judgment |
| local file / pasted code | read as given; the source URL must be supplied | solid |

Code for a system other than Strudel is declined at Intake/Resolve.

### 4. Fidelity

Code is written verbatim into the fenced block. Only two normalisations:
line endings to LF, and trimming blank space at the very start and end.
No prettifier, no comment stripping, no reordering. Header comments
(`@title`, `@by`, `@license`) stay inside the code, as `dinofunk.md`
already does.

This needs one fix in `scripts/lib/patterns-manifest.mjs`: `extractCode`
takes the first fenced block with a three-backtick regex, so a pattern
containing a line of ``` would be truncated at it. `write` instead uses a
fence one backtick longer than the longest run of backticks in the code,
and `extractCode` matches the opening fence's exact length. Round-trip is
tested byte-for-byte on fixtures, including one with backticks in the
code.

### 5. Source URL

Best effort, never a reason to fail (per the developer): a strudel.cc
link if there is one, otherwise the URL the code came from — for
repository files, the file's URL on the repository's branch (not
commit-pinned; readable and good enough). The manifest still requires
*some* URL, so pasted code with no origin makes the skill ask; nothing is
invented.

### 6. Attribution

The model judges from what the source offers (header `@by`, repository
owner, page byline). Where it is unclear or ambiguous the skill asks, with
options, and records the answer in `source_author`. A recurring shape is
"script author vs the artist of the piece being transcribed"; the options
offered are typically (a) the script author, (b) the original artist,
(c) both in the form "script by A, after B", (d) leave blank. Authors are
**not** added as tags by default: tags render as filter chips for every
distinct tag, so an import with many authors would bury the genre and
theme tags, and search does not match authors (making it do so is a
possible follow-up, not part of this change). Licence never gates.

### 7. Playback gate

A candidate must evaluate without a pattern error and have every sound
loaded. Two tiers, chosen by measurement in the groundwork spike:

- **Real engine (the gate):** headless Chromium driving the same code path
  as `e2e/pattern-playback.spec.ts`, using Playwright as a library (no MCP
  needed). The spec gains an id filter and a changed-only mode (CI checks
  only patterns whose files differ from the base), and its
  missing-sound detection is extracted so `check` and the spec share it.
- **Node triage (optional):** evaluate with the Strudel packages in plain
  Node, query a few cycles, and compare the sound names against the
  loaded banks — milliseconds per pattern, useful to sift a large import
  before the browser tier. Built only if the spike shows it is reliable;
  it never replaces the real-engine gate (visuals and browser-only APIs).

CI remains the backstop: the full playback test runs before every deploy,
so a bad file cannot ship. Its 300 s timeout is sized for ~50 patterns at
~2 s each; changed-only mode and a timeout that scales with the catalog
size keep a 100-pattern import from breaking CI.

A candidate that needs code from outside its own file is detected by the
error (`x is not a function`, `x is not defined`) and reported as a
dependency; the skill asks (skip / include the missing code / other) and
never decides alone.

### 8. Identity and repeatability

The id is derived from the source file name or title (kebab-case),
unique across the manifest; on collision the skill asks or suffixes.
Existing ids never change. `write` finds an existing entry by matching
`source_url` in front matter: same source and same code is a no-op, changed
code is shown as a diff and updated in place under the same id. A source
whose entry exists is never added twice.

### 9. Trigger discipline

The skill's description says it needs a concrete resource, and its first
step refuses to proceed without one. It does not browse or search for
sources on its own.

### 10. What the workflow touches

Files in `content/patterns/` only, plus the local database via
`patterns:sync` so the result can be seen in the local library. No remote
database, no push, no deploy: the next push deploys and reconciles. The
skill ends by offering a local commit.

## Risks / Trade-offs

- **[The short-link backend changes]** → `resolve` reports it plainly and
  the skill falls back to a pasted code block; the other shapes are
  unaffected.
- **[The model misjudges attribution]** → the single review table shows
  every author before anything is written, and doubt is asked, not
  guessed.
- **[A bulk import has many failures]** (work-in-progress songs, missing
  helper code, unknown samples) → expected; the review shows pass/fail
  per item with reasons and only passing items are offered for writing.
- **[Playback check flakiness]** → a first-beat miss while a pack loads
  is possible (as in the library preview); `check` waits for evaluation
  and reports a sound as missing only if it stays missing.
- **[CI time on a big import]** → changed-only mode plus a scaling
  timeout.
- **[Fidelity vs. a helper dependency]** → never silently altered; the
  developer chooses.

## Migration Plan

No data or schema change. New files under `.claude/skills/` and
`scripts/patterns/`; a small, compatible change to the manifest reader
(existing three-backtick files parse as before). Rollback is deleting the
skill and scripts; the library itself is unaffected.
