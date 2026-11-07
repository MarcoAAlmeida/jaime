import { parse as parseMini } from '@strudel/mini/krill-parser.js'
import type { AnalysisError, MiniModifier, MiniNode, MiniString, Position } from './types.ts'
import type { EsNode } from './walk.ts'

// Which strings are mini-notation mirrors @strudel/transpiler's own rules
// (transpiler.mjs: isStringWithDoubleQuotes, isBackTickString,
// findMiniDisableRanges) — copied, not imported, so the analysis doesn't
// pull in @strudel/core. Re-check these when bumping @strudel/*.

/** `// mini-off` … `// mini-on` regions; an unclosed mini-off runs to the end of the code. */
export function findMiniDisableRanges(comments: { value: string, start: number, end: number }[], codeEnd: number): [number, number][] {
  const ranges: [number, number][] = []
  const stack: number[] = []
  for (const comment of comments) {
    const value = comment.value.trim()
    if (value.startsWith('mini-off')) {
      stack.push(comment.start)
    }
    else if (value.startsWith('mini-on')) {
      const start = stack.pop()
      if (start !== undefined) ranges.push([start, comment.end])
    }
  }
  while (stack.length) ranges.push([stack.pop()!, codeEnd])
  return ranges
}

export function isMiniDisabled(offset: number, ranges: [number, number][]): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end)
}

/** Double-quoted string literal, or a backtick template that isn't a tagged template's quasi. */
export function isMiniLiteral(node: EsNode, parent: EsNode | null): boolean {
  if (node.type === 'Literal') return typeof node.raw === 'string' && node.raw[0] === '"'
  if (node.type === 'TemplateLiteral') return parent?.type !== 'TaggedTemplateExpression'
  return false
}

type Positioner = (from: number, to: number) => Position

// krill's raw output: { type_, source_, arguments_, options_, location_ }.
interface KrillNode {
  type_: string
  source_?: unknown
  arguments_?: Record<string, unknown>
  options_?: { ops?: { type_: string, arguments_?: Record<string, unknown> }[], weight?: number, reps?: number }
  location_?: { start: { offset: number }, end: { offset: number } }
}

const ALIGNMENTS: Record<string, 'sequence' | 'stack' | 'alternation' | 'polymeter' | 'choice' | 'feet'> = {
  fastcat: 'sequence',
  stack: 'stack',
  polymeter_slowcat: 'alternation',
  polymeter: 'polymeter',
  rand: 'choice',
  feet: 'feet',
}

/**
 * Parses one mini-notation literal. `literalStart` is the offset of its
 * opening quote in `source`; the literal is parsed quoted, exactly as
 * Strudel does, so krill's offsets are relative to that quote.
 */
export function analyzeMiniLiteral(
  source: string,
  literal: EsNode,
  at: Positioner,
): { miniString: MiniString, error: AnalysisError | null } {
  const literalStart = literal.start
  const position = at(literal.start, literal.end)
  if (literal.type === 'TemplateLiteral' && (literal.expressions as unknown[]).length > 0) {
    return { miniString: { position, tree: null, skipped: 'interpolated' }, error: null }
  }
  // The raw text between the quotes, so offsets stay exact even with escapes.
  const content = source.slice(literal.start + 1, literal.end - 1)

  let parsed: KrillNode
  try {
    parsed = parseMini(`"${content}"`) as KrillNode
  }
  catch (e) {
    const err = e as { message?: string, location?: { start: { offset: number }, end: { offset: number } } }
    const from = literalStart + (err.location?.start.offset ?? 0)
    const to = literalStart + (err.location?.end.offset ?? content.length + 2)
    return {
      miniString: { position, tree: null },
      error: { kind: 'mini', message: err.message ?? String(e), position: at(from, Math.max(to, from)) },
    }
  }

  const trimmed = (start: number, end: number): Position => {
    let from = literalStart + start
    let to = literalStart + end
    while (from < to && /\s/.test(source[from]!)) from++
    while (to > from && /\s/.test(source[to - 1]!)) to--
    return at(from, to)
  }
  const span = (nodes: MiniNode[], fallback: Position): Position =>
    nodes.length ? at(Math.min(...nodes.map(n => n.position.from)), Math.max(...nodes.map(n => n.position.to))) : fallback

  const convertAtom = (k: KrillNode): MiniNode => {
    const value = String(k.source_)
    const pos = trimmed(k.location_!.start.offset, k.location_!.end.offset)
    return value === '~' || value === '-'
      ? { type: 'rest', position: pos, modifiers: [] }
      : { type: 'atom', value, position: pos, modifiers: [] }
  }

  const convertModifiers = (k: KrillNode): MiniModifier[] => {
    const mods: MiniModifier[] = []
    for (const op of k.options_?.ops ?? []) {
      const args = op.arguments_ ?? {}
      switch (op.type_) {
        case 'stretch':
          mods.push({ kind: 'speed', direction: args.type === 'slow' ? 'slow' : 'fast', amount: convert(args.amount as KrillNode) })
          break
        case 'bjorklund':
          mods.push({
            kind: 'euclid',
            pulses: convert(args.pulse as KrillNode),
            steps: convert(args.step as KrillNode),
            rotation: args.rotation ? convert(args.rotation as KrillNode) : null,
          })
          break
        case 'replicate':
          mods.push({ kind: 'replicate', count: Number(args.amount) })
          break
        case 'degradeBy':
          mods.push({ kind: 'degrade', amount: typeof args.amount === 'number' ? args.amount : null })
          break
        case 'tail':
          mods.push({ kind: 'index', value: convert(args.element as KrillNode) })
          break
        default:
          mods.push({ kind: 'other', name: op.type_ })
      }
    }
    // `@n` and `_` lengthen an element; `!n` raises weight and reps together.
    const weight = k.options_?.weight ?? 1
    const reps = k.options_?.reps ?? 1
    if (weight / reps !== 1) mods.push({ kind: 'elongate', weight: weight / reps })
    return mods
  }

  const convertPattern = (k: KrillNode, fallback: Position): MiniNode => {
    const alignment = String(k.arguments_?.alignment ?? 'fastcat')
    const type = ALIGNMENTS[alignment] ?? 'sequence'
    const raw = (k.source_ as KrillNode[]) ?? []
    let children = raw.map(c => convert(c))
    if (type !== 'sequence') {
      // Each branch of `<a b>`, `{a b}`, `[a, b]`, `a | b` and `a . b` is
      // itself a sequence; a lone sequence or a one-element branch is
      // unwrapped so `<c3 e3>` reads as an alternation of c3 and e3.
      if ((type === 'alternation' || type === 'polymeter') && children.length === 1 && children[0]!.type === 'sequence') {
        children = (children[0] as Extract<MiniNode, { children: MiniNode[] }>).children
      }
      else {
        children = children.map(c => c.type === 'sequence' && c.children.length === 1 && c.modifiers.length === 0 ? c.children[0]! : c)
      }
    }
    const node: MiniNode = { type, children, position: span(children, fallback), modifiers: [] }
    if (type === 'polymeter' && k.arguments_?.stepsPerCycle) node.steps = convert(k.arguments_.stepsPerCycle as KrillNode)
    return node
  }

  function convert(k: KrillNode): MiniNode {
    if (k.type_ === 'atom') return convertAtom(k)
    if (k.type_ === 'element') {
      const inner = convert(k.source_ as KrillNode)
      inner.modifiers.push(...convertModifiers(k))
      // A sub-pattern's range is its element's: brackets and modifiers included.
      if (inner.type !== 'atom' && inner.type !== 'rest' && k.location_) {
        inner.position = trimmed(k.location_.start.offset, k.location_.end.offset)
      }
      return inner
    }
    return convertPattern(k, position)
  }

  const tree = convertPattern(parsed, trimmed(1, content.length + 1))
  if (tree.type !== 'atom' && tree.type !== 'rest') tree.position = trimmed(1, content.length + 1)
  return { miniString: { position, tree }, error: null }
}
