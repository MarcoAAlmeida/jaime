/** A loosely-typed ESTree node as acorn produces it. */
export interface EsNode {
  type: string
  start: number
  end: number
  [key: string]: unknown
}

function isNode(value: unknown): value is EsNode {
  return typeof value === 'object' && value !== null && typeof (value as EsNode).type === 'string'
}

/**
 * Depth-first, source-order walk over every node, passing its parent and
 * the property it hangs off. Returning `false` from `enter` skips the
 * node's children.
 */
export function walk(
  node: EsNode,
  enter: (node: EsNode, parent: EsNode | null, key: string | null) => boolean | void,
  parent: EsNode | null = null,
  key: string | null = null,
): void {
  if (enter(node, parent, key) === false) return
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue
    const child = node[k]
    if (Array.isArray(child)) {
      for (const c of child) if (isNode(c)) walk(c, enter, node, k)
    }
    else if (isNode(child)) {
      walk(child, enter, node, k)
    }
  }
}
