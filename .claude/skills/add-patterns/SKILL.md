---
name: add-patterns
description: Add Strudel patterns to jaime's Pattern Library from a concrete source the developer provides — a strudel.cc link (#code or ?short), a raw/gist/GitHub file URL, a GitHub repository or directory (bulk), a documentation page, a local file, or pasted code together with where it came from. Resolves the source to code, judges attribution (asks when unclear), requires the pattern to actually play, shows one review of exactly what will happen, and once the developer approves it writes content/patterns/*.md, commits and pushes (CI tests and deploys), then reports and stops. Do NOT use for open-ended requests with no source ("add some songs by a band"); ask for a link or repository instead.
allowed-tools: Bash(npm run pattern:*), Bash(node scripts/patterns/*), Bash(git status:*), Bash(git log:*), Bash(git add content/patterns/*), Bash(git commit:*), Bash(git push), Read, Write
license: MIT
metadata:
  author: jaime
  version: "1.1"
---

Add patterns to the curated library from a source the developer hands you.

The library is `content/patterns/<id>.md`; every deploy reconciles the
database to those files, and **deploying means commit + push: CI (Workers
Builds) runs the tests and then deploys** — you never run a deploy script by
hand. The judgment is yours; the deterministic work is in four scripts
(`npm run pattern:<name>`), each printing JSON on stdout. You write the files,
and — after the developer approves the review (step 6) — commit and push,
then report and stop.

## When to use — and when not

Use it when the developer supplies a **concrete resource**:
a strudel.cc link (`#…` or `?short`), a raw / gist / GitHub blob URL, a
GitHub repository or directory, a documentation page, a local file, or pasted
code **with its origin**.

If there is no resource — "add some Cardiacs songs", "find good techno
patterns" — **stop and ask for one**. Do not search the web for sources or
invent them. If the resource is not Strudel (Tidal, Sonic Pi, SuperCollider…)
say so and add nothing.

## Do the steps — don't improvise

Do what these steps and the developer's request say, and nothing more. If you
think an extra check, an extra change, or a different approach would help,
**ask first** and wait; never just do it.

## The steps

Work through these in order. Never write a pattern file before step 6 is
approved.

### 1. Intake
Say what you were given and what you will do with it. Check it is a concrete
resource (above). For local files or pasted code you need the origin URL; ask
if it wasn't given.

### 2. Resolve
```
npm run pattern:resolve -- "<link | path | ->" [--source-url <url>]
```
Reads a source, prints `{ ok, candidates[], skipped[], notes[] }` or
`{ ok:false, reason, message }`. Each candidate has `code`, `sourceUrl`,
`path?`, `hints:{title,author,license}`, `existing?` (already in the
library), `helper?`, `notes[]`. Never writes anything.

If `ok:false`, act on `reason` (details in `references/link-shapes.md`):

| reason | do |
| --- | --- |
| `needs-reader` | a web page, not a code file — fetch and read it yourself, extract the code blocks, and carry on with them (source URL = the page, or the strudel.cc link if it offers one) |
| `short-link-unavailable` | strudel.cc's store couldn't be reached — ask the developer to paste the code |
| `not-strudel` | say why, add nothing |
| `not-found`, `http`, `unsupported`, `not-base64`, `error` | report the message; ask for another route (paste the code, a different link) |

Skip nothing silently: mention `skipped[]` (with reasons) and `helper: true`
candidates to the developer.

### 3. Vet
- **Attribution.** Decide each candidate's author from `hints`, the
  repository owner, the page. **If it is unclear or ambiguous, ask** with
  concrete options (see `references/attribution.md`) and use the answer.
  Licence is *not* a gate — never refuse or delay for it.
- **Already in the library** (`existing`): it will be an update, not a
  duplicate; say so.
- **Helper files** (`helper: true`, or code that only defines `register()`
  functions): not standalone patterns — leave them out unless the developer
  says otherwise.

### 4. Check — nothing is added unless it plays
Save the candidates you intend to add as JSON (`[{ "label", "code" }]`) in the
OS temp directory (never in the repo), then:
```
npm run pattern:check -- --candidates <file.json>
```
This is the real gate: headless Chromium through the library's real preview
path, using temporary *local* rows it removes afterwards. It needs no server
running (it starts one — slow the first time, a few minutes; ~2 s per pattern
after). For a big batch you may first run `--fast` (Node only, milliseconds
each) to sift obvious failures, but **`--fast` is triage, never the gate**:
its `pass` still needs the browser check, and its failures should be
confirmed there before you call a pattern broken.

Per candidate `status` is `pass`, `error`, `missing-sounds`, `dependency`
(or `inconclusive` from `--fast`). Only `pass` is eligible to be written.
Report the rest with the reason and do not write them:

- **`missing-sounds`** — names the sound(s). Often a pack the pattern must load
  itself (e.g. `amen` → `samples('github:yaxu/clean-breaks/main')`). Adding
  that line changes the code, so **ask** before doing it; the original stays
  the default.
- **`dependency`** — it uses something not defined in its file (`x is not a
  function / not defined`): a helper defined elsewhere, or a typo. **Report
  and ask**: skip it, include the missing code (the developer supplies or
  approves it), or something else. Never decide alone.
- **`error`** — report the message; nothing is written for it.

Passing the check is the bar. Don't invent further tests of a pattern's
quality.

### 5. Author
For every eligible candidate propose:
- `id` — kebab-case from the title (or the source file name). Ids never
  change once a pattern exists; a collision is reported by `write` and needs a
  different id.
- `title` — from the header/hints, tidied only if clearly needed
  (e.g. drop a "(work in progress)" suffix only if the developer agrees).
- `tags` — **reuse the library's tags**: run `npm run pattern:tags` and pick
  from what exists; show any new tag as *new*. Apply the developer's shared
  tags to a batch. Do **not** add authors as tags unless asked.
- `author` (from step 3), `favorite` (only if the developer asks — see
  *Favourites*), `sourceUrl` (from `resolve`; strudel.cc link preferred when
  there is one, otherwise where it came from — never a reason to fail).

### 6. Review — say exactly what will happen, then wait
Run `git status` and `git log origin/main..HEAD --oneline` first. Then show a single review for the whole batch and
**wait for approval**; accept edits and drops. It must say:

| id | title | author | tags | source | check | favourite |
| --- | --- | --- | --- | --- | --- | --- |

- **What will be written:** the file path(s), created or updated, and any
  *new* tags.
- **What happens on approval:** the pattern file(s) are committed (only
  those) and **pushed**; CI runs the tests and then deploys. You do not watch
  the deploy — you report and stop.
- **Anything else the push will carry:** any *other* commits not yet pushed
  (`git log origin/main..HEAD`) go up and deploy with it — name them so the
  developer isn't surprised. (Uncommitted changes don't ship; CI builds what is
  pushed.)
- The failures/skips below, with reasons.

Write nothing until the developer approves.

### 7. Write
Build a spec array `[{ title, sourceUrl, code, tags, author, favorite, id }]`
in the OS temp directory and run:
```
npm run pattern:write -- <spec.json>          # add --update to apply changes to existing entries
```
Read `results[].action`:
`created`, `updated`, `unchanged` are done. `would-update` → show what
changed (`changes[]`) and only re-run with `--update` after the developer
agrees. `collision` → ask for another id. `invalid` → report the problems.
`write` syncs the **local** database so the pattern appears in the local
library.

### 8. Ship — commit and push, then stop
The developer approved the review, so this is expected, not optional:

1. **Commit** only the pattern file(s) written (`git add content/patterns/<id>.md …`),
   message like `content: add <title> (<source>)` — never other files.
2. **Push** (`git push`). That is the deploy: CI runs `npm test`, then the
   deploy. **Do not run `npm run deploy` yourself.**
3. **Report and stop:** what was created/updated/unchanged/skipped (with
   reasons), the commit, and that CI is now testing and deploying. **Do not
   poll the live site or the build afterwards** — the developer will say if a
   pattern doesn't show up or the build breaks; then look into it.

## Favourites

`favorite: true` is what makes a pattern a **starter**: it appears in the
Composition Room's "Load a starter" picker and in the homepage's "Start from
a pattern" section — both read the favourites list, so there is nothing else to
do. Favourites carry the tag `starter` plus two descriptive tags (for example
`starter, electro, samples`). Set the flag only when the developer asks for it.

## Rules

- **Fidelity.** Code goes in exactly as found: comments, header blocks,
  indentation and blank lines kept. The only changes are line endings → LF and
  blank edges trimmed (the scripts do this). No reformatting, no "fixing".
- **A source URL is always recorded**; ask if there isn't one.
- **Licence never gates**; attribution is given by recording the source.
- **Ask, don't guess**, on authorship, dependencies, id collisions and
  unresolvable sources — with options. And ask before doing anything these
  steps don't call for.
- **Nothing is written before the review is approved.** Until then the only
  changes are temporary local check rows (removed again) and the resolve/check
  outputs in the OS temp directory.
- **Never write to a remote database yourself** — the deploy's reconcile does
  that. Push only as the approved Ship step, never a manual deploy.
- **Repeatable.** Re-running on a source updates the existing entry (matched by
  source URL) and never duplicates or renames.
- A failing item is **reported, never silently dropped**.

## Reference

- `references/file-format.md` — the pattern file and what the scripts guarantee.
- `references/link-shapes.md` — each kind of source and how `resolve` treats it.
- `references/attribution.md` — judging authorship, the options to offer.
- `content/patterns/README.md` — the manifest and reconcile semantics.
