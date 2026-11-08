## 1. Dependencies and module skeleton

- [x] 1.1 Add `acorn` to `package.json` `dependencies` at `^8.14.0`
      (the range `@strudel/transpiler` declares); confirm `npm install`
      leaves the resolved version unchanged.
- [x] 1.2 Create `shared/strudel/` with the public types (`Position`,
      `NameUse`, `MiniString`, `MiniNode`, `AnalysisError`,
      `StrudelAnalysis`, `Location`) and an `index.ts` re-exporting the
      API. Only erasable TS syntax, explicit `.ts` relative imports, no
      aliases (design Decision 1).
- [x] 1.3 Positions helper: offset → `{ from, to, line, column }`
      (1-based line/column, UTF-16 offsets). Test: ranges slice back to
      the exact text, including after an emoji in a comment.

## 2. JavaScript parsing and names used

- [x] 2.1 `analyzeStrudel(source)`: parse with acorn using the
      transpiler's options plus `onComment`; on a JS syntax error
      return `names: []`, `miniStrings: []` and one positioned error
      (`kind: 'js'`). Test: `note("c e").s("piano"` → one error at
      line 1, column 22 (1-based).
- [x] 2.2 Minimal ESTree walker that tracks the parent and the
      call/argument index (no new dependency).
- [x] 2.3 Collect script-declared names script-wide (variables,
      function/class declarations, parameters incl. arrow and
      destructuring) and the fixed JS-globals list (Decision 5).
- [x] 2.4 Emit `NameUse`s (call / method / reference) in source order,
      excluding declared names, globals, labels (`$:`), object keys and
      methods on globals. Tests: the method-chain, nested-args, `$:`
      blocks, declared-name and `Math.random()` fixtures from the
      spec; a test documenting the script-wide shadowing trade-off.

## 3. Mini-notation

- [x] 3.1 Mini-string detection mirroring the transpiler (double
      quotes, untagged backticks, mini-off/mini-on ranges incl.
      unclosed mini-off; interpolated backticks reported as not
      analysable); a comment points at the transpiler functions it
      copies. Tests: one fixture per rule, incl. single-quoted
      `samples('github:…')` producing no tree.
- [x] 3.2 Parse each mini string with `@strudel/mini/krill-parser.js`
      (quoted, offset by the literal's start); a parse failure becomes
      a `kind: 'mini'` error positioned in the source while other
      strings still parse. Test: `stack(s("bd [sd"), note("c e g"))`.
- [x] 3.3 Re-shape krill's tree into our `MiniNode` types (sequence,
      sub-sequence, alternation, polymeter, atom, rest; modifiers
      speed, euclid, replicate, elongate, degrade, choice) with
      whitespace-trimmed atom ranges. Tests: one fixture per construct
      (`bd(3,8)`, `<c3 e3>*2`, `{a b c}%4`, `bd!3`, `bd@3`, `hh?`,
      `bd|sd`, `~`), asserting exact ranges.

## 4. Locate and known names

- [x] 4.1 `locateAt(analysis, offset)`: innermost call, argument index,
      enclosing-call chain, and innermost mini node when inside a mini
      string; `null` outside every call. Tests: the three spec
      scenarios plus a position on a method name.
- [x] 4.2 `unknownNames(analysis, known)`: exact, case-sensitive match;
      never reports declared names. Tests: `lpf` passes, `cutoff`
      (synonym) passes, `lpff` reported with position, helper function
      not reported.
- [x] 4.3 `scripts/lib/known-strudel-names.mjs`: build the set from
      `content/knowledge/strudel.json` (function titles + synonyms).
      `node --test` file that also imports `shared/strudel/index.ts`
      directly — proves the Node import path works — and runs a real
      library pattern through `unknownNames`.

## 5. Verify

- [x] 5.1 Vitest suite (`test/strudel-code-analysis.test.ts`, Workers
      pool — proves Worker compatibility) and `npm run test:scripts`
      green.
- [x] 5.2 `npm run typecheck` clean.
- [x] 5.3 Smoke run: analyse every `content/patterns/*.md` pattern's
      code; report how many parse, how many mini errors, and the
      distinct names unknown to the docs (expected: a short list of
      real-but-undocumented names like `setcps`). Record the summary
      here; fix analysis bugs it turns up.

      **Result (2026-11-07):** 76/76 patterns parse; 1,052 mini strings,
      0 mini errors, 0 interpolated. The run found one bug: methods a
      pattern defines with `register('bassenv', …)` were listed as
      Strudel names. They now count as script-declared (spec, design and
      a test updated). Names still unknown to the docs (occurrences):
      `_scope`×16, `_pianoroll`×15, `piano`×8, `setcps`×7, `setCpm`×7,
      `s_polymeter`×6, `map`×5, `dict`×4, `setDefaultVoicings`×4, `cps`×3,
      `_pitchwheel`, `innerJoin`, `setVoicingRange`, `setCps`,
      `_punchcard`, `collect`, `fm1`. All of these are real Strudel
      functions the docs corpus doesn't cover, except `map`. `map` is
      JavaScript's array method called on a script variable, which a
      static check can't tell apart from a pattern method (a known
      limitation, accepted).
      Also: `tsconfig.tests.json`'s `include` replaced the server
      project's and dropped `shared/**/*.d.ts`; added it back so the test
      typecheck sees the `krill-parser.js` declaration.
- [x] 5.4 After the developer's review: sync `strudel-code-analysis`
      (new) into `openspec/specs/`; archive.
