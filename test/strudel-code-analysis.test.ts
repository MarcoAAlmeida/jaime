import { describe, expect, it } from 'vitest'
import { analyzeStrudel, locateAt, unknownNames } from '../shared/strudel'
import type { MiniNode, StrudelAnalysis } from '../shared/strudel'

// add-strudel-code-analysis — static analysis of Strudel source. Runs in
// the Workers pool, which also proves the analysis loads in a Worker.

const slice = (a: StrudelAnalysis, p: { from: number, to: number }) => a.source.slice(p.from, p.to)
const namesOf = (a: StrudelAnalysis) => a.names.map(n => `${n.kind}:${n.name}`)
const tree = (src: string, i = 0) => {
  const t = analyzeStrudel(src).miniStrings[i]!.tree
  expect(t).not.toBeNull()
  return t as Extract<MiniNode, { children: MiniNode[] }>
}

describe('positions', () => {
  it('every reported range slices back to exactly its text', () => {
    const a = analyzeStrudel('note("c e g").s("piano").lpf(800)')
    for (const n of a.names) expect(slice(a, n.position)).toBe(n.name)
  })

  it('survives non-ASCII text before the element', () => {
    const a = analyzeStrudel('// 🦁 roar\ns("bd  sd").fast(2)')
    expect(a.names.map(n => slice(a, n.position))).toEqual(['s', 'fast'])
    const atoms = tree('// 🦁 roar\ns("bd  sd").fast(2)').children
    expect(atoms.map(n => slice(a, n.position))).toEqual(['bd', 'sd'])
  })

  it('gives a 1-based line and column', () => {
    const a = analyzeStrudel('s("bd")\n  .lpf(800)')
    expect(a.names[1]!.position).toMatchObject({ line: 2, column: 4 })
  })
})

describe('names used', () => {
  it('lists every link of a method chain, in source order', () => {
    const a = analyzeStrudel('note("c e g").s("piano").lpf(800)')
    expect(namesOf(a)).toEqual(['call:note', 'method:s', 'method:lpf'])
    expect(a.names.map(n => n.position.from)).toEqual([0, 14, 25])
  })

  it('finds calls nested in arguments', () => {
    const a = analyzeStrudel('stack(s("bd*4"), note("c").off(1/8, x => x.add(7)))')
    expect(a.names.map(n => n.name)).toEqual(['stack', 's', 'note', 'off', 'add'])
  })

  it('analyses every $: block', () => {
    const a = analyzeStrudel('$: s("bd*4")\n$: note("c e").sound("sawtooth")\n_$: s("hh*8")')
    expect(a.names.map(n => n.name)).toEqual(['s', 'note', 'sound', 's'])
  })

  it('reports bare references such as sine', () => {
    const a = analyzeStrudel('s("hh*8").lpf(sine.range(200, 2000)).gain(silence)')
    expect(namesOf(a)).toEqual(['call:s', 'method:lpf', 'reference:sine', 'method:range', 'method:gain', 'reference:silence'])
  })

  it('leaves out script-declared names, JS globals and methods on globals', () => {
    const a = analyzeStrudel([
      'const drums = s("bd sd")',
      'function wobble(p, { amt = rand } = {}) { return p.lpf(amt) }',
      'drums.fast(2).gain(Math.random())',
      'console.log(wobble(drums))',
    ].join('\n'))
    expect(a.names.map(n => n.name)).toEqual(['s', 'rand', 'lpf', 'fast', 'gain'])
  })

  it('leaves out pattern methods the script registers', () => {
    const a = analyzeStrudel('register(\'bassenv\', (pat) => pat.lpf(200))\nnote("c1").bassenv()')
    expect(a.names.map(n => n.name)).toEqual(['register', 'lpf', 'note'])
  })

  it('declared names are script-wide, so a shadowing parameter hides the name everywhere (accepted trade-off)', () => {
    const a = analyzeStrudel('const f = (note) => note.fast(2)\nnote("c")')
    expect(a.names.map(n => n.name)).toEqual(['fast'])
  })

  it('does not report object keys, labels or member property reads', () => {
    const a = analyzeStrudel('const o = { lpf: 1 }\nfoo: s("bd").lpf(o.lpf)')
    expect(namesOf(a)).toEqual(['call:s', 'method:lpf'])
  })

  it('never evaluates the code', () => {
    const a = analyzeStrudel('samples(\'github:tidalcycles/dirt-samples\')\ns("bd").play()')
    expect(a.errors).toEqual([])
    expect(a.names.map(n => n.name)).toEqual(['samples', 's', 'play'])
    expect(analyzeStrudel(a.source)).toEqual(a)
  })
})

describe('mini-notation strings', () => {
  it('double-quoted and untagged backtick strings are mini; single-quoted are not', () => {
    const a = analyzeStrudel('samples(\'github:x/y\')\ns("bd sd")\nnote(`c e`)')
    expect(a.miniStrings.map(m => slice(a, m.position))).toEqual(['"bd sd"', '`c e`'])
  })

  it('tagged templates are not mini', () => {
    expect(analyzeStrudel('tidal`sound "bd"`').miniStrings).toEqual([])
  })

  it('interpolated backtick strings are reported as not analysable', () => {
    const a = analyzeStrudel('const n = 2\ns(`bd*${n}`)')
    expect(a.miniStrings).toHaveLength(1)
    expect(a.miniStrings[0]).toMatchObject({ tree: null, skipped: 'interpolated' })
  })

  it('respects mini-off … mini-on, and an unclosed mini-off runs to the end', () => {
    const a = analyzeStrudel('s("a")\n// mini-off\ns("b")\n// mini-on\ns("c")\n// mini-off\ns("d")')
    expect(a.miniStrings.map(m => slice(a, m.position))).toEqual(['"a"', '"c"'])
  })

  it('euclid: s("bd(3,8)")', () => {
    const [bd] = tree('s("bd(3,8)")').children
    expect(bd).toMatchObject({ type: 'atom', value: 'bd' })
    expect(bd!.modifiers).toMatchObject([{ kind: 'euclid', pulses: { value: '3' }, steps: { value: '8' }, rotation: null }])
  })

  it('alternation with speed: note("<c3 e3>*2")', () => {
    const src = 'note("<c3 e3>*2")'
    const [alt] = tree(src).children
    expect(alt).toMatchObject({ type: 'alternation', children: [{ value: 'c3' }, { value: 'e3' }] })
    expect(alt!.modifiers).toMatchObject([{ kind: 'speed', direction: 'fast', amount: { value: '2' } }])
    expect(src.slice(alt!.position.from, alt!.position.to)).toBe('<c3 e3>*2')
  })

  it('polymeter with steps: {a b c}%4', () => {
    const [poly] = tree('s("{a b c}%4")').children
    expect(poly).toMatchObject({ type: 'polymeter', steps: { value: '4' } })
    expect((poly as { children: MiniNode[] }).children.map(c => (c as { value: string }).value)).toEqual(['a', 'b', 'c'])
  })

  it('replicate, elongate, degrade, slow, index', () => {
    const kids = tree('s("bd!3 sd@3 hh? oh?0.3 cp/2 bd:3")').children
    expect(kids.map(k => k.modifiers)).toMatchObject([
      [{ kind: 'replicate', count: 3 }],
      [{ kind: 'elongate', weight: 3 }],
      [{ kind: 'degrade', amount: null }],
      [{ kind: 'degrade', amount: 0.3 }],
      [{ kind: 'speed', direction: 'slow', amount: { value: '2' } }],
      [{ kind: 'index', value: { value: '3' } }],
    ])
  })

  it('random choice, stack, sub-sequence and rests', () => {
    expect(tree('s("bd|sd")')).toMatchObject({ type: 'choice', children: [{ value: 'bd' }, { value: 'sd' }] })
    expect(tree('s("[bd, hh hh]")').children[0]).toMatchObject({
      type: 'stack',
      children: [{ type: 'atom', value: 'bd' }, { type: 'sequence', children: [{ value: 'hh' }, { value: 'hh' }] }],
    })
    expect(tree('s("bd ~ - sd")').children.map(c => c.type)).toEqual(['atom', 'rest', 'rest', 'atom'])
  })

  it('atom ranges are exact, without surrounding whitespace', () => {
    const src = 's("  bd   [sd  hh]  ")'
    const a = analyzeStrudel(src)
    const t = a.miniStrings[0]!.tree as { children: MiniNode[] }
    const sub = t.children[1] as { children: MiniNode[], position: { from: number, to: number } }
    expect(slice(a, t.children[0]!.position)).toBe('bd')
    expect(slice(a, sub.position)).toBe('[sd  hh]')
    expect(sub.children.map(c => slice(a, c.position))).toEqual(['sd', 'hh'])
  })
})

describe('syntax errors', () => {
  it('broken JavaScript gives one positioned error', () => {
    const a = analyzeStrudel('note("c e").s("piano"')
    expect(a.errors).toEqual([{ kind: 'js', message: 'Unexpected token', position: { from: 21, to: 21, line: 1, column: 22 } }])
    expect(a.names).toEqual([])
  })

  it('one broken mini string does not stop the rest', () => {
    const src = 'stack(s("bd [sd"), note("c e g"))'
    const a = analyzeStrudel(src)
    expect(a.errors).toHaveLength(1)
    const err = a.errors[0]!
    expect(err.kind).toBe('mini')
    const literal = a.miniStrings[0]!.position
    expect(err.position.from).toBeGreaterThanOrEqual(literal.from)
    expect(err.position.to).toBeLessThanOrEqual(literal.to)
    expect(a.names.map(n => n.name)).toEqual(['stack', 's', 'note'])
    expect(a.miniStrings[0]!.tree).toBeNull()
    expect(a.miniStrings[1]!.tree).not.toBeNull()
  })
})

describe('locateAt', () => {
  it('a position inside an argument', () => {
    const src = 'note("c").lpf(800)'
    const loc = locateAt(analyzeStrudel(src), src.indexOf('800') + 1)
    expect(loc).toMatchObject({ call: { name: 'lpf' }, argumentIndex: 0, miniPath: null })
  })

  it('a position inside a mini-notation string', () => {
    const src = 's("bd [sd hh]")'
    const a = analyzeStrudel(src)
    const loc = locateAt(a, src.indexOf('sd'))!
    expect(loc).toMatchObject({ call: { name: 's' }, argumentIndex: 0 })
    expect(loc.miniPath!.map(n => slice(a, n.position))).toEqual(['bd [sd hh]', '[sd hh]', 'sd'])
  })

  it('a position on whitespace between statements is empty', () => {
    const src = 's("bd")\n\nnote("c")'
    expect(locateAt(analyzeStrudel(src), src.indexOf('\n\n') + 1)).toBeNull()
  })

  it('a position on a method name gives that call with no argument, inside its enclosing calls', () => {
    const src = 'stack(note("c").lpf(800))'
    const loc = locateAt(analyzeStrudel(src), src.indexOf('lpf'))!
    expect(loc).toMatchObject({ call: { name: 'lpf' }, argumentIndex: null })
    expect(loc.enclosingCalls.map(c => c.name)).toEqual(['stack', 'lpf'])
  })
})

describe('unknownNames', () => {
  const known = new Set(['note', 's', 'lpf', 'cutoff'])

  it('documented names and synonyms pass; a misspelling is reported with its position', () => {
    const src = 'note("c").s("piano").cutoff(400).lpff(800)'
    const a = analyzeStrudel(src)
    const unknown = unknownNames(a, known)
    expect(unknown.map(n => n.name)).toEqual(['lpff'])
    expect(slice(a, unknown[0]!.position)).toBe('lpff')
  })

  it('script-declared names are never reported', () => {
    const a = analyzeStrudel('const wob = p => p.lpf(400)\nwob(note("c"))')
    expect(unknownNames(a, known)).toEqual([])
  })
})
