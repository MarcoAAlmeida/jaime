// "docs" cases: a question about Strudel, with the function names a
// correct answer must mention. See ../README.md for the field reference.
// The first 14 are the questions scripts/jah-prompt-eval.mjs has always
// used for its (formatting-only) prompt comparison; the rest add coverage
// beyond @jah's hand-written cheat-sheet (server/jah/prompt.ts), to reveal
// how much a real documentation index (roadmap Phase 1) would help.

export const docsCases = [
  { id: 'fast-basic', kind: 'docs', message: 'what does .fast do?', expect: ['fast'] },
  { id: 'kick-and-snare', kind: 'docs', message: 'how do I make a kick and snare pattern?', expect: ['s'], code: 'required' },
  { id: 'reverb-basic', kind: 'docs', message: 'how do I add reverb to a pattern?', expect: ['room'] },
  { id: 'four-on-the-floor-docs', kind: 'docs', message: 'give me a simple four on the floor beat', expect: ['s'], code: 'required' },
  { id: 'euclidean-rhythms', kind: 'docs', message: 'how do euclidean rhythms work?', expect: ['euclid'] },
  { id: 'bassline-basic', kind: 'docs', message: 'how can I make a bassline?', expect: ['note'] },
  { id: 'amen-break', kind: 'docs', message: 'how do I use the amen break?', expect: ['samples'] },
  { id: 'jungle-breakbeat', kind: 'docs', message: 'how do I make a jungle breakbeat?', expect: ['s'] },
  { id: 'polyrhythm-basic', kind: 'docs', message: 'what is a polyrhythm and how do I write one?', expect: ['fast'] },
  { id: 'lpf-basic', kind: 'docs', message: 'how do I filter a sound with lpf?', expect: ['lpf'] },
  // Either the simple `note(...)` chord-stacking approach or the dedicated
  // `chord`+`voicing` functions is a genuinely correct answer (found via
  // add-jah-knowledge-retrieval task 6.2's grounded eval run, 2026-09-25:
  // grounding surfaced `chord`/`voicing` and the model correctly switched
  // to them, which the original note-only check then failed).
  { id: 'chord-progression', kind: 'docs', message: 'how do I make a chord progression?', expect: [['note', 'chord']] },
  { id: 'every-other-cycle', kind: 'docs', message: 'how do I make a pattern that changes every other cycle?', expect: ['every'] },
  { id: 'pan-basic', kind: 'docs', message: 'how do I pan a sound left and right?', expect: ['pan'] },
  { id: 'slow-basic', kind: 'docs', message: 'how do I slow a pattern down?', expect: ['slow'] },

  { id: 'lpf-vs-hpf', kind: 'docs', message: 'what is the difference between lpf and hpf?', expect: ['lpf', 'hpf'] },
  { id: 'gain-basic', kind: 'docs', message: 'how do I make a pattern quieter?', expect: ['gain'] },
  { id: 'sometimesby-basic', kind: 'docs', message: 'how do I apply an effect to only some of the events, randomly?', expect: ['sometimesBy'] },
  { id: 'jux-basic', kind: 'docs', message: 'how do I make the left and right channels play differently?', expect: ['jux'] },
  { id: 'bank-basic', kind: 'docs', message: 'how do I switch to a different drum machine sound set?', expect: ['bank'] },
  { id: 'scale-basic', kind: 'docs', message: 'how do I use scale degrees instead of writing out note names?', expect: ['scale'] },

  // "What does this do?" cases (add-jah-script-context task 7.4): the
  // question only makes sense with the room's script — and, when present,
  // the asker's selection — in the prompt. `expect` names what the
  // selected (or, with no selection, the whole) code actually uses.
  {
    id: 'explain-selection-jux',
    kind: 'docs',
    message: 'what does this do?',
    script: 'setcps(0.5)\n\n$: s("bd*2 [~ sd] bd sd").bank("RolandTR909")\n\n$: note("c3 eb3 g3 bb3").s("sawtooth").lpf(800).jux(rev)',
    selection: '.jux(rev)',
    expect: ['jux', 'rev'],
  },
  {
    id: 'explain-selection-every',
    kind: 'docs',
    message: 'how does this work?',
    script: '$: s("hh*8").gain(0.6)\n\n$: s("bd sd bd sd").every(4, x => x.fast(2))',
    selection: '.every(4, x => x.fast(2))',
    expect: ['every', 'fast'],
  },
  {
    id: 'explain-selection-lpf-sine',
    kind: 'docs',
    message: 'why does this part sound like it sweeps up and down?',
    script: '$: note("<c2 c2 eb2 g1>*4").s("sawtooth")\n  .lpf(sine.range(200, 2000).slow(4))\n  .room(0.3)',
    selection: '.lpf(sine.range(200, 2000).slow(4))',
    expect: ['lpf', 'sine'],
  },
  {
    id: 'explain-selection-off',
    kind: 'docs',
    message: 'what is this line doing?',
    script: '$: note("c4 e4 g4 b4").s("triangle")\n  .off(0.25, x => x.add(note(7)))\n  .delay(0.25)',
    selection: '.off(0.25, x => x.add(note(7)))',
    expect: ['off', 'add'],
  },
  // `bank`/`pan` were dropped from `expect` after the 2026-10-03 run: a
  // correct explanation described them in prose ("using the Roland TR-808
  // samples", "panned with a sine wave") instead of naming the function.
  {
    id: 'explain-whole-script',
    kind: 'docs',
    message: 'can you explain how my whole script works?',
    script: 'setcps(0.6)\n\n$: s("bd(3,8)").bank("RolandTR808")\n\n$: s("hh*8").gain(0.5).pan(sine)',
    expect: ['setcps', 'sine'],
  },
  {
    // The selection sits past MAX_SCRIPT_CHARS, so buildScriptContext's
    // truncation must keep it (and nearby code) rather than the head.
    id: 'explain-selection-in-large-script',
    kind: 'docs',
    message: 'what does this do?',
    script: [
      ...Array.from({ length: 130 }, (_, i) => `$: s("hh*${(i % 4) + 4}").gain(0.${(i % 5) + 3}) // layer ${i + 1}`),
      '$: s("bd sd").sometimesBy(0.3, x => x.speed(2))',
    ].join('\n'),
    selection: '.sometimesBy(0.3, x => x.speed(2))',
    expect: ['sometimesBy', 'speed'],
  },
]
