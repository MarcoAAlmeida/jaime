import type { EsNode } from './walk.ts'
import { walk } from './walk.ts'

/** Standard JavaScript (and browser) globals — never reported as Strudel names. */
export const JS_GLOBALS: ReadonlySet<string> = new Set([
  'undefined', 'NaN', 'Infinity', 'globalThis', 'window', 'self', 'document', 'arguments',
  'Math', 'JSON', 'console', 'Object', 'Array', 'Number', 'String', 'Boolean', 'Symbol', 'BigInt',
  'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Reflect', 'Proxy', 'Intl', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout',
  'clearTimeout', 'setInterval', 'clearInterval', 'fetch', 'encodeURIComponent', 'decodeURIComponent',
])

/** Adds every identifier a binding pattern declares (`a`, `{ a, b: c }`, `[a, ...b]`, `a = 1`). */
function collectPattern(node: EsNode | null | undefined, out: Set<string>): void {
  if (!node) return
  switch (node.type) {
    case 'Identifier':
      out.add(node.name as string)
      break
    case 'ObjectPattern':
      for (const p of node.properties as EsNode[]) collectPattern(p.type === 'RestElement' ? p : p.value as EsNode, out)
      break
    case 'ArrayPattern':
      for (const e of node.elements as (EsNode | null)[]) collectPattern(e, out)
      break
    case 'RestElement':
      collectPattern(node.argument as EsNode, out)
      break
    case 'AssignmentPattern':
      collectPattern(node.left as EsNode, out)
      break
  }
}

/**
 * Every name the script declares, anywhere — collected script-wide rather
 * than per scope (design Decision 5): a parameter that shadows a Strudel
 * name hides that name everywhere in the script.
 */
export function collectDeclaredNames(program: EsNode): Set<string> {
  const declared = new Set<string>()
  walk(program, (node) => {
    switch (node.type) {
      case 'VariableDeclarator':
        collectPattern(node.id as EsNode, declared)
        break
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        collectPattern(node.id as EsNode | null, declared)
        for (const p of node.params as EsNode[]) collectPattern(p, declared)
        break
      case 'ClassDeclaration':
      case 'ClassExpression':
        collectPattern(node.id as EsNode | null, declared)
        break
      case 'CatchClause':
        collectPattern(node.param as EsNode | null, declared)
        break
      case 'CallExpression': {
        // `register('bassenv', fn)` defines a new pattern method in the script.
        const callee = node.callee as EsNode
        const first = (node.arguments as EsNode[])[0]
        if (callee.type === 'Identifier' && callee.name === 'register' && first) {
          if (first.type === 'Literal' && typeof first.value === 'string') declared.add(first.value)
          else if (first.type === 'TemplateLiteral' && (first.expressions as unknown[]).length === 0) {
            declared.add(((first.quasis as EsNode[])[0]!.value as { cooked: string }).cooked)
          }
        }
        break
      }
      case 'ImportSpecifier':
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
        collectPattern(node.local as EsNode, declared)
        break
    }
  })
  return declared
}

/** Is this identifier occurrence a name, not a value read? (property names, keys, labels) */
export function isNonReferenceIdentifier(parent: EsNode | null, key: string | null): boolean {
  if (!parent) return false
  switch (parent.type) {
    case 'MemberExpression':
      return key === 'property' && !parent.computed
    case 'Property':
    case 'MethodDefinition':
    case 'PropertyDefinition':
      return key === 'key' && !parent.computed
    case 'LabeledStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return key === 'label'
    case 'ExportSpecifier':
    case 'ImportSpecifier':
      return key === 'imported' || key === 'exported'
    case 'MetaProperty':
      return true
  }
  return false
}
