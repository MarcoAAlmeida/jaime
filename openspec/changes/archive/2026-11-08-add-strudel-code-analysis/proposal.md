## Why

The next phases of the `@jah` intelligence roadmap need to understand
Strudel code by its structure, not just as text. Phase 3's pattern
features need to know which functions a pattern uses and how its
mini-notation is shaped. The Phase 2 follow-ups and the Phase 5
debugger need to map a text position (a selection, an error) to the
call it sits in. Each of those needs could grow its own regex-based
parser. This change builds the analysis once, on top of the parsers
Strudel already ships, so that doesn't happen.

This is change 1 of 3 in Phase 3
(`docs/04-roadmap/jah-intelligence/phase-3-knows-the-patterns.md`).
Nothing calls the analysis from a user-facing path yet;
`add-pattern-musical-features` is its first consumer.

## What Changes

- New static analysis of Strudel source that never evaluates the code.
  Given a script it can:
  - list every Strudel name the code uses (free calls such as
    `stack(...)`, chained methods such as `.lpf(...)`, and bare
    references such as `sine`), each with its exact position, leaving
    out names the script declares itself;
  - locate what sits at a text position: the innermost call, which of
    its arguments, and the mini-notation node if the position falls
    inside a mini-notation string;
  - expose the mini-notation tree of every string that Strudel itself
    would read as mini-notation (sequences, `<a b>` alternation,
    `{a b}%n` polymeter, `(3,8)` euclid, `*` and `/`, `!`, `@`, `?`,
    `|`), with positions in the script's own coordinates;
  - report syntax errors, in the JavaScript or in one mini-notation
    string, with a position as well as a message. A broken mini string
    does not stop the rest of the script from being analysed;
  - check every name used against the Phase 1 Strudel docs index and
    report the ones the docs don't know, without treating them as errors.
- Reuse the parsers Strudel already uses: acorn (as configured by
  `@strudel/transpiler`) and the krill mini-notation parser from
  `@strudel/mini`. No new parser is written.
- `acorn` becomes a direct dependency. Today it is only installed
  transitively through `@strudel/transpiler`.

## Capabilities

### New Capabilities
- `strudel-code-analysis`: static, evaluation-free analysis of Strudel
  source. It covers names used, locating by position, mini-notation
  trees, positioned syntax errors, and checking names against the docs
  index.

### Modified Capabilities
<!-- none. Nothing user-visible changes in this change -->

## Impact

- **New code**: a module under `shared/` that the server (Worker), the
  client and the Node scripts can all import (see design.md), plus a
  small Node helper that builds the set of known names from
  `content/knowledge/strudel.json`.
- **Dependencies**: `acorn` added to `package.json` at the version
  `@strudel/transpiler` already resolves, so the lockfile shouldn't
  change in substance. `@strudel/mini`'s `krill-parser.js` is imported
  directly so that `@strudel/core` isn't pulled in.
- **Tests**: fixture-based unit tests (method chains, nested calls,
  `$:` blocks, mini strings of every construct, `// mini-off`, broken
  JS, broken mini) that assert exact positions.
- **No** database migration, no route, no UI, no change to the docs
  corpus, and no change to `@jah`'s behaviour.
