## 1. Dependencies and module skeleton

- [ ] 1.1 Add `acorn` to `package.json` `dependencies` at `^8.14.0`
      (the range `@strudel/transpiler` declares); confirm `npm install`
      leaves the resolved version unchanged.
- [ ] 1.2 Create `shared/strudel/` with the public types (`Position`,
      `NameUse`, `MiniString`, `MiniNode`, `AnalysisError`,
      `StrudelAnalysis`, `Location`) and an `index.ts` re-exporting the
      API. Only erasable TS syntax, explicit `.ts` relative imports, no
      aliases (design Decision 1).
- [ ] 1.3 Positions helper: offset → `{ from, to, line, column }`
      (1-based line/column, UTF-16 offsets). Test: ranges slice back to
      the exact text, including after an emoji in a comment.

## 2. JavaScript parsing and names used

- [ ] 2.1 `analyzeStrudel(source)`: parse with acorn using the
      transpiler's options plus `onComment`; on a JS syntax error
      return `names: []`, `miniStrings: []` and one positioned error
      (`kind: 'js'`). Test: `note("c e").s("piano"` → one error at
      line 1, column 22 (1-based).
- [ ] 2.2 Minimal ESTree walker that tracks the parent and the
      call/argument index (no new dependency).
- [ ] 2.3 Collect script-declared names script-wide (variables,
      function/class declarations, parameters incl. arrow and
      destructuring) and the fixed JS-globals list (Decision 5).
- [ ] 2.4 Emit `NameUse`s (call / method / reference) in source order,
      excluding declared names, globals, labels (`$:`), object keys and
      methods on globals. Tests: the method-chain, nested-args, `$:`
      blocks, declared-name and `Math.random()` fixtures from the
      spec; a test documenting the script-wide shadowing trade-off.

## 3. Mini-notation

- [ ] 3.1 Mini-string detection mirroring the transpiler (double
      quotes, untagged backticks, mini-off/mini-on ranges incl.
      unclosed mini-off; interpolated backticks reported as not
      analysable); a comment points at the transpiler functions it
      copies. Tests: one fixture per rule, incl. single-quoted
      `samples('github:…')` producing no tree.
- [ ] 3.2 Parse each mini string with `@strudel/mini/krill-parser.js`
      (quoted, offset by the literal's start); a parse failure becomes
      a `kind: 'mini'` error positioned in the source while other
      strings still parse. Test: `stack(s("bd [sd"), note("c e g"))`.
- [ ] 3.3 Re-shape krill's tree into our `MiniNode` types (sequence,
      sub-sequence, alternation, polymeter, atom, rest; modifiers
      speed, euclid, replicate, elongate, degrade, choice) with
      whitespace-trimmed atom ranges. Tests: one fixture per construct
      (`bd(3,8)`, `<c3 e3>*2`, `{a b c}%4`, `bd!3`, `bd@3`, `hh?`,
      `bd|sd`, `~`), asserting exact ranges.

## 4. Locate and known names

- [ ] 4.1 `locateAt(analysis, offset)`: innermost call, argument index,
      enclosing-call chain, and innermost mini node when inside a mini
      string; `null` outside every call. Tests: the three spec
      scenarios plus a position on a method name.
- [ ] 4.2 `unknownNames(analysis, known)`: exact, case-sensitive match;
      never reports declared names. Tests: `lpf` passes, `cutoff`
      (synonym) passes, `lpff` reported with position, helper function
      not reported.
- [ ] 4.3 `scripts/lib/known-strudel-names.mjs`: build the set from
      `content/knowledge/strudel.json` (function titles + synonyms).
      `node --test` file that also imports `shared/strudel/index.ts`
      directly — proves the Node import path works — and runs a real
      library pattern through `unknownNames`.

## 5. Verify

- [ ] 5.1 Vitest suite (`test/strudel-code-analysis.test.ts`, Workers
      pool — proves Worker compatibility) and `npm run test:scripts`
      green.
- [ ] 5.2 `npm run typecheck` clean.
- [ ] 5.3 Smoke run: analyse every `content/patterns/*.md` pattern's
      code; report how many parse, how many mini errors, and the
      distinct names unknown to the docs (expected: a short list of
      real-but-undocumented names like `setcps`). Record the summary
      here; fix analysis bugs it turns up.
- [ ] 5.4 After the developer's review: sync `strudel-code-analysis`
      (new) into `openspec/specs/`; archive.
