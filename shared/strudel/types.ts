// Public types for the Strudel code analysis (strudel-code-analysis spec).
// Kept to erasable TypeScript only — no enums, namespaces or parameter
// properties — so plain `node` scripts can import this module directly
// through Node's type stripping (see add-strudel-code-analysis design.md).

/** A range in the analysed source: UTF-16 offsets (`to` exclusive), plus a 1-based line/column of `from` for display. */
export interface Position {
  from: number
  to: number
  line: number
  column: number
}

/** One use of a name from outside the script: `stack(…)`, `.lpf(…)`, or a bare `sine`. */
export interface NameUse {
  name: string
  kind: 'call' | 'method' | 'reference'
  position: Position
}

/** A modifier on a mini-notation node: `*2`, `/2`, `(3,8)`, `!3`, `@3`, `?`, `:3`. */
export type MiniModifier =
  | { kind: 'speed', direction: 'fast' | 'slow', amount: MiniNode }
  | { kind: 'euclid', pulses: MiniNode, steps: MiniNode, rotation: MiniNode | null }
  | { kind: 'replicate', count: number }
  | { kind: 'elongate', weight: number }
  | { kind: 'degrade', amount: number | null }
  | { kind: 'index', value: MiniNode }
  | { kind: 'other', name: string }

/** A node of a mini-notation tree, re-shaped from Strudel's own parser output. */
export type MiniNode =
  | { type: 'atom', value: string, position: Position, modifiers: MiniModifier[] }
  | { type: 'rest', position: Position, modifiers: MiniModifier[] }
  | {
    type: 'sequence' | 'stack' | 'alternation' | 'polymeter' | 'choice' | 'feet'
    children: MiniNode[]
    /** Only on `polymeter`: the `%n` steps per cycle, when given. */
    steps?: MiniNode
    position: Position
    modifiers: MiniModifier[]
  }

/** A string literal that Strudel's evaluator would read as mini-notation. */
export interface MiniString {
  /** The whole literal, quotes included. */
  position: Position
  /** The parsed tree; `null` when the string failed to parse or isn't analysable. */
  tree: MiniNode | null
  /** Set when the string is mini-notation but can't be analysed statically. */
  skipped?: 'interpolated'
}

export interface AnalysisError {
  kind: 'js' | 'mini'
  message: string
  position: Position
}

/** A named call (`stack(…)`, `.lpf(…)`) with the ranges `locateAt` needs. */
export interface CallSite {
  name: string
  kind: 'call' | 'method'
  /** The whole call expression, including a method's receiver. */
  position: Position
  /** The callee name itself. */
  namePosition: Position
  args: Position[]
}

export interface StrudelAnalysis {
  source: string
  names: NameUse[]
  miniStrings: MiniString[]
  errors: AnalysisError[]
  calls: CallSite[]
}

/** What sits at a text position. */
export interface Location {
  /** The innermost named call containing the position. */
  call: CallSite
  /** Index of the argument containing the position, or `null` (e.g. on the callee name). */
  argumentIndex: number | null
  /** Every named call containing the position, outermost first (ends with `call`). */
  enclosingCalls: CallSite[]
  /** When inside a mini-notation string: the nodes containing the position, outermost first. */
  miniPath: MiniNode[] | null
}
