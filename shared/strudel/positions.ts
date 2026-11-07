import type { Position } from './types.ts'

/** Maps UTF-16 offsets in one source string to `Position`s with a 1-based line and column. */
export function createPositioner(source: string): (from: number, to: number) => Position {
  const lineStarts = [0]
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') lineStarts.push(i + 1)
  }
  return (from, to) => {
    // Last line start <= from (binary search).
    let lo = 0
    let hi = lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineStarts[mid]! <= from) lo = mid
      else hi = mid - 1
    }
    return { from, to, line: lo + 1, column: from - lineStarts[lo]! + 1 }
  }
}

export function contains(position: Position, offset: number): boolean {
  return position.from <= offset && offset < position.to
}
