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
- Change nothing until the developer has approved a review of exactly what
  will happen; then ship it (commit, push — CI deploys — confirm live).

**Non-Goals**

- Library UI or search changes (searching by author is a separate,
  possible follow-up).
- Direct database writes; an in-app add form; running a deploy script by
  hand (the push is the deploy).
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

Intake → Resolve → Vet → Check → Author → Review → Write → Ship.

- **Deterministic (scripts):** decoding, fetching, listing a repo,
  running the engine, formatting the file, dedupe by source URL.
- **Judgment (the skill, i.e. the model):** what was handed over; reading
  a page when `resolve` can't; who the author is; a good title; which
  existing tags fit; whether a candidate is really a pattern.
- **Asking (the developer):** any real doubt — ambiguous authorship, a
  dependency outside the file, an id collision, an unresolvable source.
  Options are offered; the developer's answer is used. Nothing is written
  before the single review is approved — and the skill does what its steps
  and the developer's request call for and nothing more: an extra check or
  change it thinks worthwhile is *proposed*, never just done.

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
No prettifier, no comment stripping, no reordering. "Blank space at the very
start and end" means leading blank lines and trailing whitespace: a first
line's own indentation is kept. Header comments
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

- **Real engine (the gate):** headless Chromium driving the library's real
  preview path — `check` runs `e2e/pattern-playback.spec.ts` itself (the
  Playwright *library and runner*, no MCP needed). The spec takes
  `PATTERN_IDS` (check only these) and `PLAYBACK_REPORT` (write a JSON
  outcome per pattern). A candidate that is not in the library yet is put
  there temporarily as `origin='user'` rows in the *local* database (never
  touched by reconcile), checked, and removed; nothing reaches a remote
  system. The spec also walks every catalog page: the API caps a page at
  60, and the old single `limit=200` request silently stopped checking
  after 60 patterns.
- **Node triage (spike: GO):** evaluate with the Strudel packages in plain
  Node, query a few cycles, and compare the sound names against the
  loaded banks — milliseconds per pattern, useful to sift a large import
  before the browser tier. Built only if the spike shows it is reliable;
  it never replaces the real-engine gate (visuals and browser-only APIs).

**Spike result (task 1.4).** The whole catalog (49 patterns) evaluates in
plain Node in ~0.4 s, against ~2 min in the browser. It agrees with the
browser gate on every current pattern once the REPL-provided helpers are
stubbed (`samples`, `setcps`/`setcpm`, `.p`, the drawing methods as no-ops),
and it catches, correctly: the pre-fix silent `s("amen")`, a typo'd method,
an unknown drum bank, and a helper defined outside the file. It needs the
`@kabelsalat/web` resolution workaround the Nuxt config already carries, and
the same sound banks the app's prebake loads (sample maps fetched by URL, GM
soundfont names from `@strudel/soundfonts`, synth names, bank aliases).
Limits, which set how it is used: two curated patterns (chord-voicing
based) yield **zero events in Node** at any cycle count, so "no events" is
reported as *inconclusive*, never *pass*; and a Node-only error may be a
helper the REPL provides, so it is a **triage, not a gate** — its `pass`
still gets the browser check, and its failures are confirmed there before
anything is reported as broken. `samples()` calls inside a pattern register
their names for that pattern only.

**Two ways the browser gate lied, found by running it for real** (both fixed
in the spec that `check` runs):

- *False pass.* `samples()` in one pattern's code registers its pack for the
  rest of that page's life, so a later pattern that forgot to load the same
  pack found it already there and passed — a silent pattern slipping through.
  After any pattern that calls `samples()` the next check starts on a fresh
  page load.
- *False alarm.* The app runs `prebake()` on the first Preview and does not
  await the background sample banks (drum machines…), so the first Preview
  on a cold page can fire before its sounds exist — a real, transient cold-
  start silence. Each cold page now gets a warm-up Preview whose logs are
  ignored, and waits for the bank downloads themselves, before the real
  check. (`waitForLoadState('networkidle')` looks tempting and is wrong: it
  resolves at once if the page was ever idle.)

Validated on six known cases (good drums, the pre-fix silent `amen`, `amen`
with its pack, a typo'd method, an outside helper, an unknown bank): all six
come out right, and the whole catalog passes 49/49 in ~2 min. The fast tier
gives the same verdicts on those cases in under a second.

**CI is not a backstop for this.** Workers Builds runs `npm test` (script
tests, migrate, build, vitest) and `npm run deploy`; Playwright is not part
of it, so a silent pattern would ship if nobody ran the spec. `check` is
therefore the gate, run before writing, and the full spec is worth running
before a push that adds patterns. A browser-free triage that *could* run in
vitest — and so give CI a real gate — is the reason the Node spike (task
1.4) matters. The spec's timeout scales with the number of patterns.

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

### 10. Review, then ship

Before approval the workflow changes nothing but temporary local check rows
(removed again). The review says exactly what will happen: files created or
updated, new tags, favourites, that the files will be committed and pushed
(which deploys), and — from `git log origin/main..HEAD` — any *other*
commits that will be pushed with them.

On approval the **Ship** step runs, and it is expected, not optional: write
the files (the local database is synced so the result shows locally), commit
only those files, and **push**. Deploying *is* commit + push — Workers Builds
runs `npm test` and then `npm run deploy` — so the skill never runs the deploy
script by hand (which would also read the uncommitted working tree). It then
polls the live API until each pattern is present with the expected title,
author, tags and favourite state; if one does not appear it reads the CI build
and reports what failed, rather than assuming or working around it (a failed
test run stops the deploy, which is the safety net). It writes to no remote
database itself — CI's reconcile does. Because a push carries every unpushed
commit, the review names any others that will ride along.

### 11. Favourites

`favorite: true` makes a pattern a starter: it appears in the Composition
Room's "Load a starter" picker and on the homepage's "Start from a pattern"
section (both read the favourites list, with no cap), so the skill has nothing
else to do. Favourites carry `starter` plus two descriptive tags. The flag is
set only on request, and passing the playback check is the whole bar — no
further quality tests.

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
- **[Nothing in CI runs the playback check]** → `check` gates writing; the
  Node triage, if the spike says go, can be added to vitest so CI has one.
- **[Fidelity vs. a helper dependency]** → never silently altered; the
  developer chooses.

## Migration Plan

No data or schema change. New files under `.claude/skills/` and
`scripts/patterns/`; a small, compatible change to the manifest reader
(existing three-backtick files parse as before). Rollback is deleting the
skill and scripts; the library itself is unaffected.
