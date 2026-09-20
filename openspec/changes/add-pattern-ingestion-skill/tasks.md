## 1. Groundwork

- [x] 1.1 `scripts/lib/patterns-manifest.mjs`: `extractCode` matches the
      opening fence's exact length (three-backtick files parse exactly as
      before); tests including code that contains a line of ``` (with a
      four-backtick fence) and a regression test for the existing files.
- [x] 1.2 `check` reuses the playback spec rather than a copy of it: the spec
      now records each pattern's outcome (pass / eval error / missing
      sounds) and can write it as a JSON report. (Changed from "extract a
      shared module": the check has to drive the library UI to be the real
      path, so the runner itself is the shared piece. See design 7.)
- [x] 1.3 `e2e/pattern-playback.spec.ts`: `PATTERN_IDS` filter and
      `PLAYBACK_REPORT`; walks every catalog page (the API caps a page at
      60 — the old single `limit=200` request silently checked only the
      first 60); timeout scales with the number checked. A changed-only mode
      is dropped: CI does not run Playwright, so there is no CI run to speed
      up (design 7).
- [x] 1.4 Spike (GO — see design 7): can a Node-only evaluation (Strudel packages, a few cycles
      queried, sound names compared to the loaded banks) reliably catch
      errors and missing sounds across the whole current catalog? Record
      the result and the go/no-go for the Node triage tier in design.md.

## 2. Helper scripts (`scripts/patterns/`, npm entries, offline tests)

- [ ] 2.1 `tags`: existing tags with counts.
- [ ] 2.2 `write`: JSON spec in; fence-length-safe file out; LF only, edge
      whitespace trimmed, code otherwise verbatim; validates through the
      manifest parser; dedupe by `source_url` (no-op / diff-and-update /
      new); id collision handling; local `patterns:sync`. Tests: byte-for-
      byte round trip on fixtures (comments, indentation, CRLF input,
      backticks in code), idempotent re-run, update-in-place keeps the id.
- [ ] 2.3 `resolve` — `strudel.cc/#<base64>` and raw/gist/GitHub-blob
      URLs, local files and stdin; header hints (`@title`, `@by`); refuses
      non-Strudel code; flags already-in-library candidates. Fixture tests.
- [ ] 2.4 `resolve` — GitHub repository/directory: one tree listing, raw
      fetches, candidate filtering, helper-looking files flagged. Tests
      against a saved tree and files.
- [ ] 2.5 `resolve` — `strudel.cc/?<hash>`: the client key is read from the
      live bundle at run time (never committed), any failure is a coded
      "can't resolve" (never a crash). Tests with saved responses,
      including the failure modes.
- [ ] 2.6 `check`: runs the shared playback check for the given patterns or
      code; reports pass, eval error, missing sounds, or dependency
      (`is not a function` / `is not defined`). Tests for each outcome.
- [ ] 2.7 (only if 1.4 says go) Node triage mode for `check`.

## 3. The skill

- [ ] 3.1 `.claude/skills/add-patterns/SKILL.md`: description that triggers
      only for a concrete source; the steps (Intake → Resolve → Vet → Check
      → Author → Confirm → Write → Hand off); the rules (fidelity, source
      URL, attribution with options, dependency = report and ask, repo
      only, no push).
- [ ] 3.2 `references/`: `file-format.md`, `link-shapes.md` (the table in
      design decision 3), `attribution.md` (the option set for ambiguous
      authorship).
- [ ] 3.3 `content/patterns/README.md`: document adding patterns with the
      skill and by hand.

## 4. Dogfood and verify

- [ ] 4.1 The developer runs the skill on real sources of different shapes
      (a `#base64` link, a `?short` link, a raw/gist file, a repository,
      pasted code with a source, an open-ended request with none); fix
      what breaks; record what was learned in design.md.
- [ ] 4.2 Confirm a repository import round-trips: added, reconciled
      locally, appears in the library, plays, and a second run is a no-op.
- [ ] 4.3 Typecheck, `npm test`, `playwright test` green (including the
      playback spec with the new modes).
- [ ] 4.4 `openspec validate add-pattern-ingestion-skill --strict`.
- [ ] 4.5 Sync the `pattern-ingestion`, `pattern-library` and
      `frontend-editor` deltas; archive.
