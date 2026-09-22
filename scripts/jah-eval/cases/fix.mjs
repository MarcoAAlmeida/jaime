// "fix" cases: broken code plus the error a user would see. See
// ../README.md for the field reference. Run `--validate` after editing
// any of these — it checks the broken code really fails and prints the
// evaluator's actual error next to "error" below, which is informational
// (not compared exactly by scoring) but should stay close to the truth.

export const fixCases = [
  {
    id: 'undefined-function',
    kind: 'fix',
    // .lpx is not real (unlike .lpd, a genuine low-pass-decay control —
    // --validate caught that mistake when this case first used it).
    broken: 's("bd sd").lpx(800)',
    error: 's(...).lpx is not a function',
    keep: ['s("bd sd")'],
  },
  {
    id: 'misspelled-function',
    kind: 'fix',
    broken: 's("bd sd").rev2()',
    error: 's(...).rev2 is not a function',
    keep: ['s("bd sd")'],
  },
  {
    id: 'wrong-effect-name',
    kind: 'fix',
    // the real function is .room(), not .reverb()
    broken: 's("bd sd").reverb(0.5)',
    error: 's(...).reverb is not a function',
    keep: ['s("bd sd")'],
  },
  {
    id: 'missing-closing-paren',
    kind: 'fix',
    broken: 's("bd sd".fast(2)',
    error: 'Unexpected token — a closing ")" is missing',
  },
  {
    id: 'bad-mini-notation',
    kind: 'fix',
    // unbalanced "[" inside the mini-notation string
    broken: 's("bd [sd")',
    error: '[mini] parse error: unbalanced "[" in the mini-notation string',
  },
  {
    id: 'unloaded-sound-amen',
    kind: 'fix',
    // amen is not in the default sample map; the fix is to load its pack
    broken: 's("amen")',
    error: 'missing sounds: amen',
    keep: ['amen'],
  },
  {
    id: 'wrong-argument-shape',
    kind: 'fix',
    // notes need to be one mini-notation string, not bare numbers
    broken: 'note(60 61 62)',
    error: 'Unexpected token — note() takes one mini-notation string, not bare numbers',
  },
  {
    id: 'missing-dot',
    kind: 'fix',
    // no "." between the two chained calls
    broken: 's("bd sd")fast(2)',
    error: 'Unexpected token — missing "." before fast(2)',
  },
  {
    id: 'arp-typo',
    kind: 'fix',
    // the real function is .arp(), not .arpeg()
    broken: 'note("c e g").arpeg("updown")',
    error: 'note(...).arpeg is not a function',
    keep: ['note("c e g")'],
  },
  {
    id: 'missing-quotes',
    kind: 'fix',
    // bd/sd need to be a quoted mini-notation string, not bare identifiers
    broken: 's(bd sd)',
    error: 'Unexpected token — s() needs a quoted mini-notation string, not bare words',
  },
]
