import { parse, type Comment } from 'acorn'
import { analyzeMiniLiteral, findMiniDisableRanges, isMiniDisabled, isMiniLiteral } from './mini.ts'
import { collectDeclaredNames, isNonReferenceIdentifier, JS_GLOBALS } from './names.ts'
import { contains, createPositioner } from './positions.ts'
import type { AnalysisError, CallSite, Location, MiniNode, MiniString, NameUse, StrudelAnalysis } from './types.ts'
import type { EsNode } from './walk.ts'
import { walk } from './walk.ts'

/**
 * Static, evaluation-free analysis of Strudel source (strudel-code-analysis
 * spec): the names it uses, its named calls, every mini-notation string's
 * tree, and positioned syntax errors. Never runs the code.
 */
export function analyzeStrudel(source: string): StrudelAnalysis {
  const at = createPositioner(source)
  const comments: Comment[] = []

  let program: EsNode
  try {
    // Same options @strudel/transpiler parses user code with.
    program = parse(source, {
      ecmaVersion: 2022,
      allowAwaitOutsideFunction: true,
      onComment: comments,
    }) as unknown as EsNode
  }
  catch (e) {
    const err = e as { message?: string, pos?: number }
    const pos = Math.min(err.pos ?? 0, source.length)
    // acorn appends " (line:col)" to its message; the position carries that.
    const message = (err.message ?? String(e)).replace(/ \(\d+:\d+\)$/, '')
    return { source, names: [], miniStrings: [], calls: [], errors: [{ kind: 'js', message, position: at(pos, pos) }] }
  }

  const declared = collectDeclaredNames(program)
  const isOwnOrGlobal = (name: string) => declared.has(name) || JS_GLOBALS.has(name)
  const miniDisabled = findMiniDisableRanges(comments, source.length)

  const names: NameUse[] = []
  const calls: CallSite[] = []
  const miniStrings: MiniString[] = []
  const errors: AnalysisError[] = []
  // Identifiers already reported as a call's callee, so they aren't also reported as references.
  const callees = new Set<EsNode>()

  walk(program, (node, parent, key) => {
    if (isMiniLiteral(node, parent)) {
      if (!isMiniDisabled(node.start, miniDisabled)) {
        const { miniString, error } = analyzeMiniLiteral(source, node, at)
        miniStrings.push(miniString)
        if (error) errors.push(error)
      }
      return node.type === 'TemplateLiteral' // interpolations are still code
    }

    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = node.callee as EsNode
      const args = (node.arguments as EsNode[]).map(a => at(a.start, a.end))
      if (callee.type === 'Identifier') {
        const name = callee.name as string
        callees.add(callee)
        if (!isOwnOrGlobal(name)) {
          names.push({ name, kind: 'call', position: at(callee.start, callee.end) })
        }
        calls.push({ name, kind: 'call', position: at(node.start, node.end), namePosition: at(callee.start, callee.end), args })
      }
      else if (callee.type === 'MemberExpression' && !callee.computed) {
        const property = callee.property as EsNode
        const object = callee.object as EsNode
        const name = property.name as string
        const onGlobal = object.type === 'Identifier' && JS_GLOBALS.has(object.name as string) && !declared.has(object.name as string)
        if (!onGlobal && !declared.has(name)) {
          names.push({ name, kind: 'method', position: at(property.start, property.end) })
        }
        calls.push({ name, kind: 'method', position: at(node.start, node.end), namePosition: at(property.start, property.end), args })
      }
      return
    }

    if (node.type === 'Identifier' && !callees.has(node) && !isNonReferenceIdentifier(parent, key)) {
      const name = node.name as string
      if (!isOwnOrGlobal(name)) names.push({ name, kind: 'reference', position: at(node.start, node.end) })
    }
  })

  names.sort((a, b) => a.position.from - b.position.from)
  return { source, names, miniStrings, errors, calls }
}

function miniPathAt(node: MiniNode, offset: number, path: MiniNode[] = []): MiniNode[] {
  if (!contains(node.position, offset)) return path
  path.push(node)
  if ('children' in node) {
    for (const child of node.children) {
      if (contains(child.position, offset)) return miniPathAt(child, offset, path)
    }
  }
  return path
}

/** What sits at `offset`: the innermost named call, the argument, enclosing calls, and the mini node. `null` outside every call. */
export function locateAt(analysis: StrudelAnalysis, offset: number): Location | null {
  const enclosing = analysis.calls
    .filter(c => contains(c.position, offset))
    // Outermost first: a call that contains another is larger.
    .sort((a, b) => (b.position.to - b.position.from) - (a.position.to - a.position.from))
  const call = enclosing.at(-1)
  if (!call) return null

  const argIndex = call.args.findIndex(a => contains(a, offset))
  const mini = analysis.miniStrings.find(m => m.tree && contains(m.position, offset))
  const miniPath = mini?.tree ? miniPathAt(mini.tree, offset) : []
  return {
    call,
    argumentIndex: argIndex === -1 ? null : argIndex,
    enclosingCalls: enclosing,
    miniPath: miniPath.length ? miniPath : null,
  }
}

/**
 * Names the docs index doesn't know, given its known names (function
 * names plus documented synonyms). Exact, case-sensitive match — Strudel
 * names are JavaScript identifiers. Unknown is not an error.
 */
export function unknownNames(analysis: StrudelAnalysis, known: ReadonlySet<string>): NameUse[] {
  return analysis.names.filter(n => !known.has(n.name))
}
