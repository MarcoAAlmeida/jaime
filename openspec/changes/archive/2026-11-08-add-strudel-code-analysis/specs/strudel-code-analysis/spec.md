## ADDED Requirements

### Requirement: Analysis Never Evaluates The Code

The system SHALL analyse Strudel source statically. It SHALL NOT
execute the code, produce sound or events, or need any network
access, and it SHALL give the same result for the same input every
time. The analysis SHALL be usable from the server, from the browser,
and from the project's Node scripts.

#### Scenario: Code with side effects is analysed, not run
- **WHEN** the analysed source calls functions that would play sound
  or load samples if evaluated (for example `samples('github:…')` or
  `.play()`)
- **THEN** the analysis completes, nothing is played or fetched, and
  those calls are reported like any other

#### Scenario: The same input always gives the same result
- **WHEN** the same source is analysed twice
- **THEN** both results are identical

### Requirement: Positions Are Exact Offsets Into The Analysed Source

Every position the analysis reports SHALL be a range of character
offsets into the exact source string it was given, counted the same
way the editor counts them. A position inside a string literal,
including inside mini-notation, SHALL be given in the source's own
coordinates, not relative to the string. Each position SHALL also
carry a line and column for display.

#### Scenario: A range covers exactly the named text
- **WHEN** the analysis reports the range of a call's name or of a
  mini-notation atom
- **THEN** slicing the source at that range yields exactly that name
  or atom, with no surrounding whitespace or quotes

#### Scenario: Positions survive non-ASCII text
- **WHEN** the source contains non-ASCII characters (for example an
  emoji in a comment) before the reported element
- **THEN** the reported range still slices to exactly that element

### Requirement: Lists The Strudel Names A Script Uses

The analysis SHALL list every name the script uses from outside
itself: free function calls (`stack(...)`, `note(...)`), chained method
calls at any depth (`note(...).s(...).lpf(...)`), and bare references
(`sine` in `sine.range(200, 2000)`, `silence`). Each occurrence SHALL
include its name, whether it is a free call, a method call or a bare
reference, and its position. Names the script declares itself
(variables, functions, parameters, and pattern methods it defines with
`register('name', …)`) and standard JavaScript built-ins
(such as `Math` or `console`) SHALL NOT be listed as Strudel names.

#### Scenario: A method chain lists every link
- **WHEN** the source is `note("c e g").s("piano").lpf(800)`
- **THEN** the names used are `note` (free call), `s` (method call)
  and `lpf` (method call), in source order, each at its exact position

#### Scenario: Calls nested in arguments are found
- **WHEN** the source is `stack(s("bd*4"), note("c").off(1/8, x => x.add(7)))`
- **THEN** `stack`, `s`, `note`, `off` and `add` are all listed

#### Scenario: `$:` blocks are analysed
- **WHEN** the source contains several `$:` labelled blocks
- **THEN** names from every block are listed

#### Scenario: Script-declared names are left out
- **WHEN** the source declares `const drums = s("bd sd")` and later
  uses `drums.fast(2)`
- **THEN** `s` and `fast` are listed and `drums` is not

#### Scenario: Methods the script registers are left out
- **WHEN** the source defines `register('bassenv', (pat) => pat.lpf(200))`
  and later uses `note("c1").bassenv()`
- **THEN** `register`, `lpf` and `note` are listed and `bassenv` is not

### Requirement: Locates What Sits At A Text Position

Given a position in the source, the analysis SHALL report the
innermost call that contains it, which argument of that call (if
any) contains it, the chain of enclosing calls out to the top level,
and, when the position falls inside a mini-notation string, the
innermost mini-notation node at that position. A position outside
every call SHALL give an empty result, not an error.

#### Scenario: A position inside an argument
- **WHEN** the position falls inside `800` in `note("c").lpf(800)`
- **THEN** the result is the `lpf` call, argument 0

#### Scenario: A position inside a mini-notation string
- **WHEN** the position falls on `sd` in `s("bd [sd hh]")`
- **THEN** the result is the `s` call, argument 0, with the
  mini-notation atom `sd` and its enclosing `[sd hh]` sub-sequence

#### Scenario: A position on whitespace between statements
- **WHEN** the position falls on a blank line between two statements
- **THEN** the result is empty and no error is raised

### Requirement: Exposes The Mini-Notation Tree Of Mini Strings

The analysis SHALL treat a string as mini-notation exactly when
Strudel's own evaluator would: double-quoted strings and untagged
backtick strings, but not single-quoted strings and not strings
inside a `// mini-off` … `// mini-on` region. For each one it SHALL
expose the parsed tree, covering sequences, sub-sequences `[...]`,
alternation `<...>`, polymeter `{...}` and `%`, euclidean rhythms
`(pulses,steps,rotation)`, speed `*` and `/`, replication `!`,
elongation `@`, degrade `?`, random choice `|`, rests (`~` / `-`) and
atoms, with each node's position in the source.

#### Scenario: A euclidean rhythm is recognised
- **WHEN** the source is `s("bd(3,8)")`
- **THEN** the tree holds the atom `bd` with a euclidean modifier of 3
  pulses over 8 steps

#### Scenario: Alternation and speed are recognised
- **WHEN** the source is `note("<c3 e3>*2")`
- **THEN** the tree holds an alternation of `c3` and `e3` with a speed
  modifier of 2

#### Scenario: Single-quoted strings are not mini-notation
- **WHEN** the source is `samples('github:tidalcycles/dirt-samples')`
- **THEN** no mini-notation tree is produced for that string

#### Scenario: `mini-off` regions are respected
- **WHEN** a double-quoted string sits between `// mini-off` and
  `// mini-on`
- **THEN** no mini-notation tree is produced for it

### Requirement: Reports Syntax Errors With A Position

When the source is not valid JavaScript, the analysis SHALL report the
error with its message and position instead of failing without one.
When a single mini-notation string can't be parsed, the analysis
SHALL report that error with its position in the source and SHALL
still analyse the rest of the script, including the calls around the
broken string and every other mini string.

#### Scenario: Broken JavaScript
- **WHEN** the source is `note("c e").s("piano"` (missing parenthesis)
- **THEN** the result reports one JavaScript syntax error at the end of
  the input, with line and column

#### Scenario: One broken mini string
- **WHEN** the source is `stack(s("bd [sd"), note("c e g"))`
- **THEN** the result reports a mini-notation error positioned inside
  `"bd [sd"`, and still lists `stack`, `s` and `note` and exposes the
  tree of `"c e g"`

### Requirement: Checks Names Against The Strudel Docs Index

Given the set of names the Strudel docs index knows (function names
and their documented synonyms), the analysis SHALL report each name
used that the index doesn't know, with its positions. An unknown name
SHALL be reported as unknown to the docs, not as an error, and SHALL
NOT stop the analysis. The project SHALL provide a way to build that
set of known names from the committed docs corpus.

#### Scenario: A documented function passes
- **WHEN** the source uses `lpf`, which the docs index knows
- **THEN** `lpf` is not reported as unknown

#### Scenario: A documented synonym passes
- **WHEN** the source uses a name the docs list as a synonym of a
  documented function (for example `cutoff` for `lpf`)
- **THEN** it is not reported as unknown

#### Scenario: A misspelt function is reported
- **WHEN** the source uses `.lpff(800)`
- **THEN** `lpff` is reported as unknown to the docs, with its position

#### Scenario: Script-declared names are never checked
- **WHEN** the source declares and uses its own helper function
- **THEN** that helper is not reported as unknown
