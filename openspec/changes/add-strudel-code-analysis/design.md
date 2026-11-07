## Context

Phase 3 of the `@jah` intelligence roadmap needs to understand Strudel
code by its structure: which functions a pattern uses, the shape of
its mini-notation, and which call a text position sits in. Phase 5
(the debugger) needs the same things. The roadmap brief says to reuse
the parsers Strudel already ships rather than write a new one, and
leaves open where the module lives.

What exists today:

- `@strudel/transpiler` parses user code with **acorn**
  (`ecmaVersion: 2022`, `allowAwaitOutsideFunction`, `locations`),
  walks it, and decides which strings are mini-notation. Double-quoted
  literals and untagged backtick templates are mini-notation, unless
  they sit in a `// mini-off` … `// mini-on` region. Single-quoted
  strings are plain strings. `acorn` is hoisted to the top-level
  `node_modules`, but only as the transpiler's dependency.
- `@strudel/mini`'s `krill-parser.js` is a self-contained,
  Peggy-generated parser. Its output tree is `{ type_, source_,
  arguments_, options_, location_ }`, and atom locations include
  trailing whitespace (Strudel's own `getLeafLocation` trims it).
  Importing `@strudel/mini`'s entry point pulls in `@strudel/core`,
  which needs a module-resolution hack to load in Node
  (`scripts/patterns/lib/triage.mjs`). Importing `krill-parser.js`
  directly avoids that. Verified: it parses in Node with no other
  imports.
- The Phase 1 docs corpus `content/knowledge/strudel.json` holds 565
  `function` chunks, each with `title` and `synonyms` (`lpf` →
  `cutoff`, `ctf`, `lp`). That gives 744 distinct known names. Some
  names Strudel really has (such as `setcps`) aren't in it.
- `shared/` is Nuxt's shared directory, imported as `#shared/...` by
  both `app/` and `server/`. Vitest tests in `test/` run in the
  Workers pool (workerd). Node is v24, which strips TypeScript types
  natively, so `scripts/*.mjs` can import a `.ts` file directly when
  the import has an explicit extension.

## Goals / Non-Goals

**Goals:**
- One evaluation-free analysis of Strudel source covering names used,
  locating by position, mini-notation trees, positioned errors, and
  checking names against the docs index.
- Usable unchanged by the Worker (`server/`), the browser (`app/`),
  and Node scripts (`scripts/`, the first consumer being
  `add-pattern-musical-features`).
- Exact positions, checked by fixtures.

**Non-Goals:**
- Evaluating code, producing events, or computing musical features.
  Those belong to `add-pattern-musical-features`.
- Embedding trees (roadmap decision 10).
- Tagged language literals (`tidal\`…\``, `mondo\`…\``). They are
  skipped, not parsed.
- Proper lexical scoping (see Decision 5).
- Any user-visible use. No route, UI or `@jah` change.

## Decisions

### 1. It lives in `shared/strudel/`, written as Node-importable TypeScript

`shared/` is the only place both Nuxt sides already import from, and
Phase 5 needs the analysis on the server (diagnosing an error sent
with a mention) and probably in the browser. `scripts/` would serve
only Node.

To keep it importable by plain `node` scripts as well:
- Only erasable TypeScript syntax: no `enum`, `namespace`, or
  parameter properties. Node's type stripping rejects those.
- Relative imports inside the module carry explicit `.ts` extensions.
  `allowImportingTsExtensions` is already on in Nuxt's generated
  tsconfigs.
- No `#shared`/`~` aliases inside the module. Node doesn't know them.

*Alternative considered:* writing it as `.mjs` in `scripts/lib/` with
JSDoc types. It would be importable from Nuxt too, but it would sit
outside the shared directory the server and client use, and would be
typed less strictly.

### 2. Parsers: acorn directly, krill directly

- **JavaScript:** `acorn.parse` with the transpiler's own options plus
  `onComment`, which the mini-off ranges need. `acorn` becomes a
  direct dependency in `package.json`, at the range the transpiler
  already declares (`^8.14.0`), so nothing new is downloaded.
- **Mini-notation:** `import { parse } from
  '@strudel/mini/krill-parser.js'`. The package has no `exports` map,
  so the subpath is allowed. We parse the string quoted, exactly as
  Strudel does, and add the literal's start offset.
- **Walking:** a small recursive walker over ESTree nodes, which keeps
  track of the parent and the argument index. It's about 30 lines, so
  we don't add `estree-walker` (the transpiler has its own nested
  copy) or `acorn-walk`.

*Alternative considered:* calling `transpiler()` and reading its
`miniLocations`. That only gives leaf ranges, not trees, calls or
errors, and it pulls in `@strudel/core`.

### 3. "Is this string mini-notation?" mirrors the transpiler's rules exactly

We copy the transpiler's three rules: a double-quoted `Literal`, a
`TemplateLiteral` that isn't the quasi of a `TaggedTemplateExpression`,
and not inside a mini-off range (a mini-off without a closing mini-on
runs to the end of the code). A backtick template with `${…}`
interpolations is reported as not analysable rather than guessed at.
The transpiler only reads its first quasi.

These rules are copied, not imported, so they can drift if Strudel
changes them. The pinned `@strudel/transpiler` version and a fixture
test per rule are the guard. A comment in the code points at
`transpiler.mjs` (`isStringWithDoubleQuotes`, `isBackTickString`,
`findMiniDisableRanges`).

### 4. Positions are UTF-16 offsets, with 1-based line and column

`from`/`to` are JavaScript string indices into the analysed source,
the same units acorn and CodeMirror use, so a range from the
analysis can be used directly as an editor range. Each position also
carries a `line` and `column`, both 1-based, for display. Mini atom
ranges are trimmed of whitespace the same way `getLeafLocation` does,
so slicing the source at an atom's range gives exactly the atom.

### 5. Names used: declared names come out script-wide, not by scope

A name occurrence is one of:
- **call:** a `CallExpression` whose callee is an `Identifier`
  (`stack(...)`);
- **method:** a `CallExpression` whose callee is a non-computed
  `MemberExpression`; the property name is reported (`.lpf(...)`);
- **reference:** an `Identifier` read as a value that isn't a call's
  callee (`sine` in `sine.range(...)`).

Excluded: any name the script declares anywhere (`var`/`let`/`const`,
function and class declarations, parameters including arrow
parameters, destructuring targets), the `$` of `$:` and other labels,
object-literal keys, and a fixed list of JavaScript globals (`Math`,
`console`, `JSON`, `Array`, `Object`, `Number`, `String`, `Date`,
`Promise`, `globalThis`, `window`, `undefined`, `NaN`, `Infinity`, …).
Method calls whose object is one of those globals (`Math.random()`)
are excluded too.

Declarations are collected across the whole script rather than per
scope. A helper parameter that shadows a Strudel name would hide that
name everywhere. That's rare in pattern code, and the simplicity is
worth it. If a consumer needs exact scoping, revisit then.

### 6. API shape: parse once, query many times

```ts
analyzeStrudel(source: string): StrudelAnalysis
  // { names: NameUse[], miniStrings: MiniString[], errors: AnalysisError[] }
locateAt(analysis: StrudelAnalysis, offset: number): Location | null
unknownNames(analysis: StrudelAnalysis, known: ReadonlySet<string>): NameUse[]
```

`StrudelAnalysis` keeps the acorn tree internally, so `locateAt`
doesn't parse again. If the JavaScript doesn't parse, `analyzeStrudel`
returns `names: []`, `miniStrings: []` and the one positioned error.
acorn has no error recovery, and `acorn-loose` isn't worth adding
yet. A mini string that fails to parse becomes an `AnalysisError` with
`kind: 'mini'`, and every other string is still parsed.

The mini tree is re-shaped into our own types (`sequence`,
`alternation`, `polymeter`, `atom`, `rest`, plus modifiers `speed`,
`euclid`, `replicate`, `elongate`, `degrade`, `choice`) so consumers
don't depend on krill's internal `type_`/`source_` naming. The
mapping is one function, covered by a fixture per construct.

### 7. The known-names set is built by the caller

`unknownNames` takes a `ReadonlySet<string>` and does an exact,
case-sensitive match, because Strudel names are case-sensitive
JavaScript. The shared module never loads the corpus itself: 1.2 MB
of JSON has no place in the client bundle. A Node helper,
`scripts/lib/known-strudel-names.mjs`, builds the set from
`content/knowledge/strudel.json` (function `title`s plus `synonyms`).
A server-side builder (from D1) can follow when the server needs it.

Names that are real but undocumented (`setcps`) will show as unknown.
That's the behaviour the spec asks for ("unknown to the docs", not
"invalid"), and it surfaces gaps in the docs.

## Risks / Trade-offs

- **[Copied mini rules drift from Strudel's]** → Fixtures for each
  rule. Strudel versions are pinned, and the submodule refresh is a
  deliberate act; re-run the tests whenever `@strudel/*` is bumped.
- **[`krill-parser.js` is an internal file]** → Same version pin. If a
  future version moves it, the import fails loudly at build or test
  time, not silently.
- **[Script-wide declarations can hide a shadowed Strudel name]** →
  Accepted (Decision 5) and noted in a test.
- **[Broken JavaScript gives no names]** → Accepted for now. The
  Phase 5 debugger mostly cares about the error position, which is
  reported. Revisit with `acorn-loose` if partial analysis turns out
  to be needed.
- **[Workers compatibility]** → Both parsers are pure JavaScript. The
  vitest suite runs in the Workers pool, so the tests prove it runs
  there. A `node --test` file for the names helper proves the Node
  import path.

## Migration Plan

Additive only: no data, schema or route changes. To roll back, revert
the commit.

## Open Questions

None blocking. Whether the server later needs its own known-names
builder (from D1 rather than the JSON file) is for Phase 5 to decide.
